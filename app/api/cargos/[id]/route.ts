import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaCargo } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaCargo.parse(await request.json())
    const actualizado = await prisma.cargo.update({ where: { id }, data: datos })
    return ok(actualizado)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)

    // Sus metas propias no pueden quedar como metas generales.
    const metas = await prisma.meta.count({ where: { cargoId: id } })
    if (metas > 0) {
      throw new ErrorApi(
        409,
        `No se puede eliminar: el cargo tiene ${metas} meta${metas === 1 ? '' : 's'} propia${metas === 1 ? '' : 's'}. Borralas primero en Metas.`,
      )
    }

    await prisma.cargo.delete({ where: { id } })
    return ok({ mensaje: 'Cargo eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
