import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaZona } from '@/lib/esquemas'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const pisoId = Number(new URL(request.url).searchParams.get('pisoId'))
    const zonas = await prisma.zona.findMany({
      where: pisoId ? { pisoId } : undefined,
      orderBy: { codigo: 'asc' },
      include: { _count: { select: { elementos: true } } },
    })
    return ok(zonas)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaZona.parse(await request.json())
    const creada = await prisma.zona.create({ data: datos })
    return ok(creada, 201)
  } catch (error) {
    return manejarError(error)
  }
}
