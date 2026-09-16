import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaCuadrilla } from '@/lib/esquemas'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const proyectoId = Number(new URL(request.url).searchParams.get('proyectoId'))
    const cuadrillas = await prisma.cuadrilla.findMany({
      where: proyectoId ? { proyectoId } : undefined,
      orderBy: { nombre: 'asc' },
      include: {
        proyecto: { select: { id: true, codigo: true, nombre: true } },
        _count: { select: { integrantes: true, registros: true } },
      },
    })
    return ok(cuadrillas)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaCuadrilla.parse(await request.json())
    const creada = await prisma.cuadrilla.create({ data: datos })
    return ok(creada, 201)
  } catch (error) {
    return manejarError(error)
  }
}
