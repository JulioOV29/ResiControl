import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaMeta } from '@/lib/esquemas'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const proyectoId = Number(new URL(request.url).searchParams.get('proyectoId'))
    const metas = await prisma.meta.findMany({
      where: proyectoId ? { proyectoId } : undefined,
      orderBy: [{ vigenciaDesde: 'desc' }],
      include: {
        proyecto: { select: { id: true, codigo: true, nombre: true } },
        actividad: { select: { id: true, nombre: true, unidadMedida: true } },
        cargo: { select: { id: true, nombre: true } },
      },
    })
    return ok(metas)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaMeta.parse(await request.json())
    const creada = await prisma.meta.create({ data: datos })
    return ok(creada, 201)
  } catch (error) {
    return manejarError(error)
  }
}
