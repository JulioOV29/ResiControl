import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta } from '@/lib/api'
import { esquemaActividad } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaActividad.parse(await request.json())
    const actualizada = await prisma.actividad.update({ where: { id }, data: datos })
    return ok(actualizada)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    await prisma.actividad.delete({ where: { id } })
    return ok({ mensaje: 'Actividad eliminada' })
  } catch (error) {
    return manejarError(error)
  }
}
