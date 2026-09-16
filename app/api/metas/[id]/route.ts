import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta } from '@/lib/api'
import { esquemaMeta } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaMeta.parse(await request.json())
    const actualizada = await prisma.meta.update({ where: { id }, data: datos })
    return ok(actualizada)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    await prisma.meta.delete({ where: { id } })
    return ok({ mensaje: 'Meta eliminada' })
  } catch (error) {
    return manejarError(error)
  }
}
