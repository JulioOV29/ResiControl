import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, ErrorApi } from '@/lib/api'

type Contexto = { params: Promise<{ id: string; asignacionId: string }> }

/** Cierra la asignacion sin borrarla, para conservar el historial. */
export async function PATCH(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const { asignacionId } = await params
    const id = Number(asignacionId)
    if (!Number.isInteger(id) || id <= 0) throw new ErrorApi(400, 'Identificador invalido')

    const cerrada = await prisma.cuadrillaTrabajador.update({
      where: { id },
      data: { activo: false, fechaFin: new Date() },
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
