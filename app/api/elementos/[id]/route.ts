import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta } from '@/lib/api'
import { esquemaElemento } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaElemento.parse(await request.json())
    const actualizado = await prisma.elementoConstructivo.update({ where: { id }, data: datos })
    return ok(actualizado)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    await prisma.elementoConstructivo.delete({ where: { id } })
    return ok({ mensaje: 'Elemento constructivo eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
