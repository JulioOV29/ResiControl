import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, idDeRuta, ErrorApi, sinPrecios } from '@/lib/api'
import { esquemaRegistroObra, esquemaRegistroAvance } from '@/lib/esquemas'
import {
  relacionesRegistro,
  estadoDeObra,
  tarifaDeTrabajador,
  cantidadParaObra,
  validarObraUnica,
  validarCoherencia,
  exigirPrecioAcordado,
  validarFechaEnCadena,
  validarTareaParaObra,
  sincronizarEstadoTarea,
  tareaDeLaObra,
  bloquearRegistros,
  exigirNoPagado,
} from '@/lib/consultas'
import { horaADate, cantidadDeObra, num } from '@/lib/calculos'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Contexto) {
  try {
    const sesion = await exigirSesion()
    const id = await idDeRuta(params)
    const registro = await prisma.registroEjecucion.findUnique({
      where: { id },
      include: relacionesRegistro,
    })
    if (!registro) throw new ErrorApi(404, 'El registro no existe')
    return ok(sinPrecios(registro, sesion.user.rol))
  } catch (error) {
    return manejarError(error)
  }
}

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const sesion = await exigirPermiso('registrar')
    const id = await idDeRuta(params)

    const actual = await prisma.registroEjecucion.findUnique({
      where: { id },
      select: {
        id: true,
        registroOrigenId: true,
        registroAnteriorId: true,
        actividadId: true,
        elementoId: true,
        trabajadorId: true,
        tareaId: true,
        largo: true,
        alto: true,
        cantidadTotal: true,
        valorM2: true,
      },
    })
    if (!actual) throw new ErrorApi(404, 'El registro no existe')
    await exigirNoPagado(prisma, id, 'modificar')

    const cuerpo = await request.json()
    const esApertura = actual.registroOrigenId === null
    const raizId = actual.registroOrigenId ?? actual.id
    /** Jornadas viejas sin precio toman el precio acordado si ya existe. */
    const sinPrecio = actual.valorM2 === null

    if (esApertura) {
      const { horaInicio, horaFinal, tareaId, cantidadTotal, ...datos } =
        esquemaRegistroObra.parse(cuerpo)

      await validarCoherencia(datos)
      // No puede quedar encima de otra obra con el mismo elemento y actividad.
      await validarObraUnica(datos.elementoId, datos.actividadId, id)
      await validarFechaEnCadena(actual, datos.fechaEjecucion)
      // Si cambia de tarea, la nueva debe estar libre y coincidir.
      if (tareaId) await validarTareaParaObra(tareaId, datos, id)

      const mismoTrabajo =
        datos.elementoId === actual.elementoId && datos.actividadId === actual.actividadId
      const medidas = await cantidadParaObra(
        datos.elementoId,
        datos.actividadId,
        cantidadTotal ?? (mismoTrabajo && actual.cantidadTotal !== null ? num(actual.cantidadTotal) : null),
      )

      /**
       * Si el trabajo es el mismo, la obra conserva las medidas que copio al abrirse
       * (aunque despues cambien el elemento o sus vanos). Solo la cantidad escrita
       * a mano (und, m3, kg) se puede corregir.
       */
      if (mismoTrabajo) {
        medidas.largo = num(actual.largo)
        medidas.alto = num(actual.alto)
        if (medidas.modo !== 'captura' || cantidadTotal == null) {
          medidas.cantidad = cantidadDeObra(actual)
        }
      }

      /** El precio solo se recalcula si cambia la actividad o el trabajador. */
      const cambioActividad = datos.actividadId !== actual.actividadId
      const cambioElemento = datos.elementoId !== actual.elementoId
      const cambioTrabajador = datos.trabajadorId !== actual.trabajadorId
      const recalcular = cambioActividad || cambioTrabajador

      // Precio obligatorio solo si cambia el trabajador o la actividad
      // (se pueden corregir horas de jornadas viejas sin precio).
      if (recalcular) await exigirPrecioAcordado(datos.trabajadorId, datos.actividadId)

      /**
       * Si cambia el elemento o la actividad, los avances cambian tambien.
       * Cada avance se recalcula con el precio de su propio trabajador.
       */
      const avances =
        cambioActividad || cambioElemento
          ? await prisma.registroEjecucion.findMany({
              where: { registroOrigenId: id },
              select: {
                id: true,
                trabajadorId: true,
                cuadrillaId: true,
                fechaEjecucion: true,
                codigoRegistro: true,
              },
            })
          : []

      // Los trabajadores de los avances tambien necesitan precio para la nueva actividad.
      if (cambioActividad) {
        for (const a of avances) await exigirPrecioAcordado(a.trabajadorId, datos.actividadId)
      }
      // Las cuadrillas de los avances tienen que servir en el nuevo elemento.
      if (cambioElemento) {
        for (const a of avances) {
          await validarCoherencia({
            elementoId: datos.elementoId,
            cuadrillaId: a.cuadrillaId,
            trabajadorId: a.trabajadorId,
            fechaEjecucion: a.fechaEjecucion,
          })
        }
      }

      const [tarifaPropia, ...tarifasAvances] = await Promise.all([
        recalcular || sinPrecio
          ? tarifaDeTrabajador(datos.trabajadorId, datos.actividadId)
          : Promise.resolve(null),
        ...avances.map((a) =>
          cambioActividad
            ? tarifaDeTrabajador(a.trabajadorId, datos.actividadId)
            : Promise.resolve(null),
        ),
      ])

      const actualizado = await prisma.$transaction(async (tx) => {
        // Bloquea la obra y sus jornadas: nadie las paga ni las cambia mientras tanto.
        await bloquearRegistros(tx, [id, ...avances.map((a) => a.id)])
        await exigirNoPagado(tx, id, 'modificar')
        for (const a of avances) {
          await exigirNoPagado(tx, a.id, 'cambiar de elemento ni de actividad')
        }

        // La cantidad no puede quedar por debajo de lo ya ejecutado.
        const obra = await estadoDeObra(raizId, id, tx)
        const acumuladoOtros = obra ? obra.ejecutado : 0
        if (datos.m2Ejecutados + acumuladoOtros > medidas.cantidad + 0.005) {
          throw new ErrorApi(
            409,
            `La obra de ${medidas.actividad.nombre} en ${medidas.elemento.codigoDwg} es de ${medidas.cantidad.toFixed(2)} ${medidas.unidad}, y llevaria ${(datos.m2Ejecutados + acumuladoOtros).toFixed(2)} ${medidas.unidad} sumando sus avances`,
          )
        }

        const editado = await tx.registroEjecucion.update({
          where: { id },
          data: {
            ...datos,
            largo: medidas.largo,
            alto: medidas.alto,
            cantidadTotal: medidas.cantidad,
            tareaId,
            ...(recalcular || sinPrecio ? { valorM2: tarifaPropia } : {}),
            horaInicio: horaADate(horaInicio),
            horaFinal: horaADate(horaFinal),
            usuarioActualizaId: sesion.user.id,
          },
          include: relacionesRegistro,
        })
        for (const [indice, a] of avances.entries()) {
          await tx.registroEjecucion.update({
            where: { id: a.id },
            data: {
              elementoId: datos.elementoId,
              actividadId: datos.actividadId,
              ...(cambioActividad ? { valorM2: tarifasAvances[indice] } : {}),
              usuarioActualizaId: sesion.user.id,
            },
          })
        }
        return editado
      })

      // Actualiza la tarea que se suelta y la que se toma.
      if (actual.tareaId !== tareaId) await sincronizarEstadoTarea(actual.tareaId)
      await sincronizarEstadoTarea(tareaId)

      return ok(actualizado)
    }

    // Un avance solo cambia sus datos; no cambia de obra.
    const { horaInicio, horaFinal, registroAnteriorId, ...datos } =
      esquemaRegistroAvance.parse({ ...cuerpo, registroAnteriorId: actual.registroAnteriorId })
    void registroAnteriorId

    await validarCoherencia({
      elementoId: actual.elementoId,
      cuadrillaId: datos.cuadrillaId,
      trabajadorId: datos.trabajadorId,
      fechaEjecucion: datos.fechaEjecucion,
    })
    await validarFechaEnCadena(actual, datos.fechaEjecucion)

    // Si cambia el trabajador, se usa su precio.
    const cambioTrabajadorAvance = datos.trabajadorId !== actual.trabajadorId
    if (cambioTrabajadorAvance) await exigirPrecioAcordado(datos.trabajadorId, actual.actividadId)
    const tarifaAvance =
      cambioTrabajadorAvance || sinPrecio
        ? await tarifaDeTrabajador(datos.trabajadorId, actual.actividadId)
        : null

    const actualizado = await prisma.$transaction(async (tx) => {
      // Mismo bloqueo que al crear un avance: primero la obra, luego la jornada.
      await bloquearRegistros(tx, [raizId])
      await bloquearRegistros(tx, [id])
      await exigirNoPagado(tx, id, 'modificar')

      const obra = await estadoDeObra(raizId, id, tx)
      if (obra && datos.m2Ejecutados > obra.pendiente + 0.005) {
        throw new ErrorApi(
          409,
          `A la obra solo le quedan ${obra.pendiente.toFixed(2)} ${obra.unidad} por ejecutar, sin contar este registro`,
        )
      }

      return tx.registroEjecucion.update({
        where: { id },
        data: {
          ...datos,
          ...(cambioTrabajadorAvance || sinPrecio ? { valorM2: tarifaAvance } : {}),
          horaInicio: horaADate(horaInicio),
          horaFinal: horaADate(horaFinal),
          usuarioActualizaId: sesion.user.id,
        },
        include: relacionesRegistro,
      })
    })

    await sincronizarEstadoTarea(await tareaDeLaObra(raizId))

    return ok(actualizado)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('registrar')
    const id = await idDeRuta(params)

    const base = await prisma.registroEjecucion.findUnique({
      where: { id },
      select: { registroOrigenId: true },
    })
    if (!base) throw new ErrorApi(404, 'El registro no existe')
    const raizId = base.registroOrigenId ?? id

    // Todo dentro de una transaccion con la obra bloqueada: no se cruza con una liquidacion.
    const tareaId = await prisma.$transaction(async (tx) => {
      await bloquearRegistros(tx, [raizId])
      await bloquearRegistros(tx, [id])
      await exigirNoPagado(tx, id, 'eliminar')

      const registro = await tx.registroEjecucion.findUniqueOrThrow({
        where: { id },
        select: {
          codigoRegistro: true,
          registroOrigenId: true,
          tareaId: true,
          continuacion: { select: { codigoRegistro: true } },
          _count: { select: { avances: true } },
          registroOrigen: { select: { tareaId: true } },
        },
      })

      // Solo se borra el ultimo registro de la cadena.
      if (registro.continuacion) {
        throw new ErrorApi(
          409,
          `No se puede eliminar: ${registro.codigoRegistro} tiene un avance posterior (${registro.continuacion.codigoRegistro}). Elimina primero el ultimo de la cadena.`,
        )
      }
      if (registro.registroOrigenId === null && registro._count.avances > 0) {
        throw new ErrorApi(
          409,
          'No se puede eliminar el registro que abre la obra mientras tenga avances',
        )
      }

      await tx.registroEjecucion.delete({ where: { id } })
      return registro.registroOrigenId === null
        ? registro.tareaId
        : (registro.registroOrigen?.tareaId ?? null)
    })

    // Actualiza el estado de la tarea.
    await sincronizarEstadoTarea(tareaId)

    return ok({ mensaje: 'Registro eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
