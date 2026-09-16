import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaTrabajador } from '@/lib/esquemas'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const soloActivos = new URL(request.url).searchParams.get('activos') === '1'
    const trabajadores = await prisma.trabajador.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      include: {
        cargo: { select: { id: true, nombre: true } },
        asignaciones: {
          where: { activo: true },
          take: 1,
          include: { cuadrilla: { select: { id: true, nombre: true } } },
        },
      },
    })
    return ok(trabajadores)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaTrabajador.parse(await request.json())
    const creado = await prisma.trabajador.create({ data: datos })
    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
