import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaTorre } from '@/lib/esquemas'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const proyectoId = Number(new URL(request.url).searchParams.get('proyectoId'))
    const torres = await prisma.torre.findMany({
      where: proyectoId ? { proyectoId } : undefined,
      orderBy: { codigo: 'asc' },
      include: {
        proyecto: { select: { codigo: true, nombre: true } },
        _count: { select: { pisos: true } },
      },
    })
    return ok(torres)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaTorre.parse(await request.json())
    const creada = await prisma.torre.create({ data: datos })
    return ok(creada, 201)
  } catch (error) {
    return manejarError(error)
  }
}
