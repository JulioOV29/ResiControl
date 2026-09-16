import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaProyecto } from '@/lib/esquemas'

export async function GET() {
  try {
    await exigirSesion()
    const proyectos = await prisma.proyecto.findMany({
      orderBy: { codigo: 'asc' },
      include: { _count: { select: { torres: true, cuadrillas: true, metas: true } } },
    })
    return ok(proyectos)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaProyecto.parse(await request.json())
    const creado = await prisma.proyecto.create({ data: datos })
    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
