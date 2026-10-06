import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, ErrorApi } from '@/lib/api'
import { esquemaCierreAsignacion } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string; asignacionId: string }> }

/** Ids de la cuadrilla y de la asignacion, validados. */
async function idsDeRuta(params: Contexto['params']) {
  const { id: cuadrilla, asignacionId } = await params
  const id = Number(asignacionId)
  const cuadrillaId = Number(cuadrilla)
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(cuadrillaId) || cuadrillaId <= 0) {
    throw new ErrorApi(400, 'Identificador invalido')
  }
  return { id, cuadrillaId }
}

/** Cierra la asignacion sin borrarla (se conserva el historial). */
export async function PATCH(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const { id, cuadrillaId } = await idsDeRuta(params)

    /** La fecha de cierre la manda el navegador (hora local, no UTC). */
    const cuerpo = await request.json().catch(() => ({}))
    const { fechaFin } = esquemaCierreAsignacion.parse(cuerpo ?? {})

    const asignacion = await prisma.cuadrillaTrabajador.findFirst({
      where: { id, cuadrillaId },
      select: { fechaInicio: true, trabajadorId: true },
    })
    if (!asignacion) throw new ErrorApi(404, 'La asignacion no existe')

    // Sus jornadas en la cuadrilla no pueden quedar despues del cierre.
    const jornada = await prisma.registroEjecucion.findFirst({
      where: {
        trabajadorId: asignacion.trabajadorId,
        cuadrillaId,
        fechaEjecucion: { gt: fechaFin, gte: asignacion.fechaInicio },
      },
      orderBy: { fechaEjecucion: 'desc' },
      select: { codigoRegistro: true, fechaEjecucion: true },
    })
    if (jornada) {
      throw new ErrorApi(
        409,
        `Tiene la jornada ${jornada.codigoRegistro} del ${jornada.fechaEjecucion.toISOString().slice(0, 10)} en esta cuadrilla: no puede cerrarse antes de esa fecha`,
      )
    }

    // Evita un error de la base si la fecha de cierre es anterior al inicio.
    if (fechaFin < asignacion.fechaInicio) {
      throw new ErrorApi(
        409,
        `La asignacion empieza el ${asignacion.fechaInicio.toISOString().slice(0, 10)}: no puede cerrarse antes`,
      )
    }

    const cerrada = await prisma.cuadrillaTrabajador.update({
      where: { id },
      data: { activo: false, fechaFin },
    })
    return ok(cerrada)
  } catch (error) {
    return manejarError(error)
  }
}

/** Borra la asignacion. Solo para corregir errores de captura (sin jornadas). */
export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const { id, cuadrillaId } = await idsDeRuta(params)

    const asignacion = await prisma.cuadrillaTrabajador.findFirst({
      where: { id, cuadrillaId },
      select: { trabajadorId: true, fechaInicio: true, fechaFin: true },
    })
    if (!asignacion) throw new ErrorApi(404, 'La asignacion no existe')

    const jornada = await prisma.registroEjecucion.findFirst({
      where: {
        trabajadorId: asignacion.trabajadorId,
        cuadrillaId,
        fechaEjecucion: {
          gte: asignacion.fechaInicio,
          ...(asignacion.fechaFin ? { lte: asignacion.fechaFin } : {}),
        },
      },
      select: { codigoRegistro: true },
    })
    if (jornada) {
      throw new ErrorApi(
        409,
        `No se puede eliminar: el trabajador tiene jornadas en esta cuadrilla en ese periodo (${jornada.codigoRegistro}). Cierra la asignacion en lugar de borrarla.`,
      )
    }

    await prisma.cuadrillaTrabajador.delete({ where: { id } })
    return ok({ mensaje: 'Asignacion eliminada del historial' })
  } catch (error) {
    return manejarError(error)
  }
}
