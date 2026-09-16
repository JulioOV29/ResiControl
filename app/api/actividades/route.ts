import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaActividad } from '@/lib/esquemas'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const soloActivas = new URL(request.url).searchParams.get('activas') === '1'
    const actividades = await prisma.actividad.findMany({
      where: soloActivas ? { activo: true } : undefined,
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { registros: true, metas: true } } },
    })
    return ok(actividades)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaActividad.parse(await request.json())
    const creada = await prisma.actividad.create({ data: datos })
    return ok(creada, 201)
  } catch (error) {
    return manejarError(error)
  }
}
