import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaRegistroObra, esquemaRegistroAvance } from '@/lib/esquemas'
import { relacionesRegistro, aHora, estadoDeObra, tarifaDeActividad } from '@/lib/consultas'

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
      },
    })
    if (!actual) throw new ErrorApi(404, 'El registro no existe')

    const cuerpo = await request.json()
    const esApertura = actual.registroOrigenId === null
    const raizId = actual.registroOrigenId ?? actual.id

    if (esApertura) {
      const { horaInicio, horaFinal, ...datos } = esquemaRegistroObra.parse(cuerpo)

      // Reducir el area por debajo de lo ya ejecutado en la cadena dejaria la
      // obra por encima del 100%.
      const obra = await estadoDeObra(raizId, id)
      const areaNueva = datos.largo * datos.alto
      const acumuladoOtros = obra ? obra.ejecutado : 0
      if (datos.m2Ejecutados + acumuladoOtros > areaNueva + 0.005) {
        throw new ErrorApi(
          409,
          `Con esas medidas el area seria ${areaNueva.toFixed(2)} m2, y la obra ya lleva ${(datos.m2Ejecutados + acumuladoOtros).toFixed(2)} m2 sumando sus avances`,
        )
      }

      // La tarifa congelada solo se vuelve a leer si cambio la actividad: en
      // ese caso la que estaba guardada era la de otro trabajo. Corregir una
      // hora o unos metros no puede repreciar la jornada.
      const cambioActividad = datos.actividadId !== actual.actividadId

      const actualizado = await prisma.registroEjecucion.update({
        where: { id },
        data: {
          ...datos,
          ...(cambioActividad ? { valorM2: await tarifaDeActividad(datos.actividadId) } : {}),
          horaInicio: aHora(horaInicio),
          horaFinal: aHora(horaFinal),
          usuarioActualizaId: sesion.user.id,
        },
        include: relacionesRegistro,
      })
      return ok(actualizado)
    }

    // Un avance solo cambia sus propios datos; no se mueve de obra.
    const { horaInicio, horaFinal, registroAnteriorId, ...datos } =
      esquemaRegistroAvance.parse({ ...cuerpo, registroAnteriorId: actual.registroAnteriorId })
    void registroAnteriorId

    const obra = await estadoDeObra(raizId, id)
    if (obra && datos.m2Ejecutados > obra.pendiente + 0.005) {
      throw new ErrorApi(
        409,
        `A la obra solo le quedan ${obra.pendiente.toFixed(2)} m2 por ejecutar, sin contar este registro`,
      )
    }

    const actualizado = await prisma.registroEjecucion.update({
      where: { id },
      data: {
        ...datos,
        horaInicio: aHora(horaInicio),
        horaFinal: aHora(horaFinal),
        // Trazabilidad: queda quien creo y quien modifico por ultima vez.
        usuarioActualizaId: sesion.user.id,
      },
      include: relacionesRegistro,
    })

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
        continuacion: { select: { codigoRegistro: true } },
        _count: { select: { avances: true } },
      },
    })
    if (!registro) throw new ErrorApi(404, 'El registro no existe')

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

    await prisma.registroEjecucion.delete({ where: { id } })
    return ok({ mensaje: 'Registro eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
