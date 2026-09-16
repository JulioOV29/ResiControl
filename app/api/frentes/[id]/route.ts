import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta } from '@/lib/api'
import { esquemaFrente } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaFrente.parse(await request.json())
    const actualizado = await prisma.frenteTrabajo.update({ where: { id }, data: datos })
    return ok(actualizado)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    await prisma.frenteTrabajo.delete({ where: { id } })
    return ok({ mensaje: 'Frente de trabajo eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
