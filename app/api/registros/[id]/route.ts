import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaRegistroObra, esquemaRegistroAvance } from '@/lib/esquemas'
import {
  relacionesRegistro,
  aHora,
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
} from '@/lib/consultas'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Contexto) {
  try {
    await exigirSesion()
    const id = await idDeRuta(params)
    const registro = await prisma.registroEjecucion.findUnique({
      where: { id },
      include: relacionesRegistro,
    })
    if (!registro) throw new ErrorApi(404, 'El registro no existe')
    return ok(registro)
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
        cantidadTotal: true,
        codigoRegistro: true,
        liquidacion: { select: { codigo: true } },
      },
    })
    if (!actual) throw new ErrorApi(404, 'El registro no existe')

    // Una jornada pagada ya es parte de un comprobante: cambiar sus metros, su
    // trabajador o su fecha cambiaria lo que dice un pago ya hecho.
    if (actual.liquidacion) {
      throw new ErrorApi(
        409,
        `${actual.codigoRegistro} ya se pago en la liquidacion ${actual.liquidacion.codigo}: no se puede modificar. Si hay un error, un administrador tiene que anular esa liquidacion primero.`,
      )
    }

    const cuerpo = await request.json()
    const esApertura = actual.registroOrigenId === null
    const raizId = actual.registroOrigenId ?? actual.id

    if (esApertura) {
      const { horaInicio, horaFinal, tareaId, cantidadTotal, ...datos } =
        esquemaRegistroObra.parse(cuerpo)

      await validarCoherencia(datos)
      // Mover la obra a otro muro o a otra actividad no puede dejarla encima de
      // una obra que ya existe alli.
      await validarObraUnica(datos.elementoId, datos.actividadId, id)
      await validarFechaEnCadena(actual, datos.fechaEjecucion)
      // La obra puede ganar, perder o cambiar de tarea; la tarea nueva tiene
      // que estar libre y coincidir en elemento y actividad.
      if (tareaId) await validarTareaParaObra(tareaId, datos, id)

      /**
       * Las medidas se vuelven a leer del elemento: si la obra se mueve a otro
       * muro, la cantidad por ejecutar es la de ese muro. Cambiarlas ya no es
       * cosa de esta pantalla, sino de la ficha del elemento constructivo.
       */
      const mismoTrabajo =
        datos.elementoId === actual.elementoId && datos.actividadId === actual.actividadId
      const medidas = await cantidadParaObra(
        datos.elementoId,
        datos.actividadId,
        // Si no llega cantidad y el trabajo es el mismo, se conserva la que tenia.
        cantidadTotal ?? (mismoTrabajo && actual.cantidadTotal !== null ? Number(actual.cantidadTotal) : null),
      )

      // Que la cantidad quede por debajo de lo ya ejecutado en la cadena dejaria
      // la obra por encima del 100%.
      const obra = await estadoDeObra(raizId, id)
      const acumuladoOtros = obra ? obra.ejecutado : 0
      if (datos.m2Ejecutados + acumuladoOtros > medidas.cantidad + 0.005) {
        throw new ErrorApi(
          409,
          `La obra de ${medidas.actividad.nombre} en ${medidas.elemento.codigoDwg} es de ${medidas.cantidad.toFixed(2)} ${medidas.unidad}, y llevaria ${(datos.m2Ejecutados + acumuladoOtros).toFixed(2)} ${medidas.unidad} sumando sus avances`,
        )
      }

      /**
       * La tarifa congelada solo se vuelve a leer si cambio la actividad o el
       * trabajador: en ese caso la guardada era la de otro trabajo o la de
       * otra persona. Corregir una hora o unos metros no puede repreciar la
       * jornada.
       */
      const cambioActividad = datos.actividadId !== actual.actividadId
      const cambioElemento = datos.elementoId !== actual.elementoId
      const cambioTrabajador = datos.trabajadorId !== actual.trabajadorId
      const recalcular = cambioActividad || cambioTrabajador

      // El precio se exige cuando cambia quien o que: corregir las horas de una
      // jornada vieja que se guardo sin precio no se bloquea.
      if (recalcular) await exigirPrecioAcordado(datos.trabajadorId, datos.actividadId)

      /**
       * Los avances heredan elemento y actividad al crearse, asi que corregirlos
       * en la apertura tiene que arrastrar la cadena entera: si no, el mismo
       * muro quedaba repartido entre dos ubicaciones o dos actividades.
       *
       * Si cambia la actividad, cada avance tiene que reprecarse con la tarifa
       * de SU trabajador, que no tiene por que ser el de la apertura: dias
       * distintos de la misma obra los puede hacer gente distinta.
       */
      const avances =
        cambioActividad || cambioElemento
          ? await prisma.registroEjecucion.findMany({
              where: { registroOrigenId: id },
              select: {
                id: true,
                trabajadorId: true,
                codigoRegistro: true,
                liquidacion: { select: { codigo: true } },
              },
            })
          : []

      // Si cambia la actividad, cada avance pasa a ser de la nueva: sus
      // trabajadores tambien tienen que tener precio para ella.
      if (cambioActividad) {
        for (const a of avances) await exigirPrecioAcordado(a.trabajadorId, datos.actividadId)
      }

      // Mover la obra arrastra a sus avances; si alguno ya se pago, no se toca.
      const pagado = avances.find((a) => a.liquidacion)
      if (pagado) {
        throw new ErrorApi(
          409,
          `El avance ${pagado.codigoRegistro} ya se pago en la liquidacion ${pagado.liquidacion!.codigo}: la obra ya no puede cambiar de elemento ni de actividad.`,
        )
      }

      const [tarifaPropia, ...tarifasAvances] = await Promise.all([
        recalcular
          ? tarifaDeTrabajador(datos.trabajadorId, datos.actividadId)
          : Promise.resolve(null),
        ...avances.map((a) =>
          cambioActividad
            ? tarifaDeTrabajador(a.trabajadorId, datos.actividadId)
            : Promise.resolve(null),
        ),
      ])

      const [actualizado] = await prisma.$transaction([
        prisma.registroEjecucion.update({
          where: { id },
          data: {
            ...datos,
            largo: medidas.largo,
            alto: medidas.alto,
            cantidadTotal: medidas.cantidad,
            tareaId,
            ...(recalcular ? { valorM2: tarifaPropia } : {}),
            horaInicio: aHora(horaInicio),
            horaFinal: aHora(horaFinal),
            usuarioActualizaId: sesion.user.id,
          },
          include: relacionesRegistro,
        }),
        ...avances.map((a, indice) =>
          prisma.registroEjecucion.update({
            where: { id: a.id },
            data: {
              elementoId: datos.elementoId,
              actividadId: datos.actividadId,
              ...(cambioActividad ? { valorM2: tarifasAvances[indice] } : {}),
              usuarioActualizaId: sesion.user.id,
            },
          }),
        ),
      ])

      // Las dos tareas implicadas: la que se suelta y la que se toma.
      if (actual.tareaId !== tareaId) await sincronizarEstadoTarea(actual.tareaId)
      await sincronizarEstadoTarea(tareaId)

      return ok(actualizado)
    }

    // Un avance solo cambia sus propios datos; no se mueve de obra.
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

    const obra = await estadoDeObra(raizId, id)
    if (obra && datos.m2Ejecutados > obra.pendiente + 0.005) {
      throw new ErrorApi(
        409,
        `A la obra solo le quedan ${obra.pendiente.toFixed(2)} ${obra.unidad} por ejecutar, sin contar este registro`,
      )
    }

    // Si la jornada cambia de trabajador, cambia lo que se paga por ella: la
    // tarifa congelada era la de la persona anterior.
    const cambioTrabajadorAvance = datos.trabajadorId !== actual.trabajadorId
    if (cambioTrabajadorAvance) await exigirPrecioAcordado(datos.trabajadorId, actual.actividadId)
    const tarifaAvance = cambioTrabajadorAvance
      ? await tarifaDeTrabajador(datos.trabajadorId, actual.actividadId)
      : null

    const actualizado = await prisma.registroEjecucion.update({
      where: { id },
      data: {
        ...datos,
        ...(cambioTrabajadorAvance ? { valorM2: tarifaAvance } : {}),
        horaInicio: aHora(horaInicio),
        horaFinal: aHora(horaFinal),
        // Trazabilidad: queda quien creo y quien modifico por ultima vez.
        usuarioActualizaId: sesion.user.id,
      },
      include: relacionesRegistro,
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

    const registro = await prisma.registroEjecucion.findUnique({
      where: { id },
      select: {
        codigoRegistro: true,
        registroOrigenId: true,
        tareaId: true,
        liquidacion: { select: { codigo: true } },
        continuacion: { select: { codigoRegistro: true } },
        _count: { select: { avances: true } },
      },
    })
    if (!registro) throw new ErrorApi(404, 'El registro no existe')

    if (registro.liquidacion) {
      throw new ErrorApi(
        409,
        `No se puede eliminar: ${registro.codigoRegistro} ya se pago en la liquidacion ${registro.liquidacion.codigo}.`,
      )
    }

    // Solo se puede borrar por el final de la cadena: quitar un eslabon del
    // medio dejaria los avances siguientes colgando de la nada.
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

    // La tarea de la obra se lee ANTES de borrar: si lo que se borra es la
    // apertura, despues ya no habria de donde sacarla.
    const tareaId =
      registro.registroOrigenId === null
        ? registro.tareaId
        : await tareaDeLaObra(registro.registroOrigenId)

    await prisma.registroEjecucion.delete({ where: { id } })

    // Al deshacer una jornada la tarea puede volver a EN_PROCESO, o a
    // PENDIENTE si se borro la obra entera.
    await sincronizarEstadoTarea(tareaId)

    return ok({ mensaje: 'Registro eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
