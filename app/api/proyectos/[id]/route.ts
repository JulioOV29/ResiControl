import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaProyecto } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Contexto) {
  try {
    await exigirSesion()
    const id = await idDeRuta(params)
    const proyecto = await prisma.proyecto.findUnique({
      where: { id },
      include: {
        torres: { orderBy: { codigo: 'asc' }, include: { _count: { select: { pisos: true } } } },
        _count: { select: { cuadrillas: true, metas: true } },
      },
    })
    if (!proyecto) throw new ErrorApi(404, 'El proyecto no existe')
    return ok(proyecto)
  } catch (error) {
    return manejarError(error)
  }
}

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaProyecto.parse(await request.json())
    const actualizado = await prisma.proyecto.update({ where: { id }, data: datos })
    return ok(actualizado)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    await prisma.proyecto.delete({ where: { id } })
    return ok({ mensaje: 'Proyecto eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
