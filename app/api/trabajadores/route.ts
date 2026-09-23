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
        // Sus precios por metro: es lo que se edita en su propia ficha.
        tarifas: {
          orderBy: { actividad: { nombre: 'asc' } },
          select: {
            id: true,
            actividadId: true,
            valorM2: true,
            actividad: { select: { id: true, nombre: true, unidadMedida: true } },
          },
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
    const { tarifas, ...datos } = esquemaTrabajador.parse(await request.json())

    // Las tarifas se crean con el trabajador, en la misma operacion: si una de
    // ellas falla, no queda una ficha a medias.
    const creado = await prisma.trabajador.create({
      data: { ...datos, tarifas: { create: tarifas } },
      include: {
        cargo: { select: { id: true, nombre: true } },
        tarifas: { select: { id: true, actividadId: true, valorM2: true } },
      },
    })
    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
