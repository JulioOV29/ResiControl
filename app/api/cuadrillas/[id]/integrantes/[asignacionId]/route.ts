import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, ErrorApi } from '@/lib/api'
import { esquemaCierreAsignacion } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string; asignacionId: string }> }

/** Cierra la asignacion sin borrarla, para conservar el historial. */
export async function PATCH(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const { asignacionId } = await params
    const id = Number(asignacionId)
    if (!Number.isInteger(id) || id <= 0) throw new ErrorApi(400, 'Identificador invalido')

    /**
     * La fecha de cierre la manda el cliente, que es quien sabe que dia es hoy
     * donde esta la obra. `new Date()` en el servidor daba la fecha UTC, y en
     * Vercel eso cerraba la asignacion con la fecha de manana desde las 7 de
     * la tarde hora de Colombia.
     */
    const cuerpo = await request.json().catch(() => ({}))
    const { fechaFin } = esquemaCierreAsignacion.parse(cuerpo ?? {})

    const asignacion = await prisma.cuadrillaTrabajador.findUnique({
      where: { id },
      select: { fechaInicio: true },
    })
    if (!asignacion) throw new ErrorApi(404, 'La asignacion no existe')

    // Sin esto, cerrar una asignacion que empieza manana reventaba contra el
    // CHECK de la base con un error ilegible.
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

/** Borra la asignacion por completo. Solo para corregir un error de captura. */
export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const { asignacionId } = await params
    const id = Number(asignacionId)
    if (!Number.isInteger(id) || id <= 0) throw new ErrorApi(400, 'Identificador invalido')

    await prisma.cuadrillaTrabajador.delete({ where: { id } })
    return ok({ mensaje: 'Asignacion eliminada del historial' })
  } catch (error) {
    return manejarError(error)
  }
}
