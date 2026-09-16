import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaCargo } from '@/lib/esquemas'

export async function GET() {
  try {
    await exigirSesion()
    const cargos = await prisma.cargo.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { trabajadores: true } } },
    })
    return ok(cargos)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaCargo.parse(await request.json())
    const creado = await prisma.cargo.create({ data: datos })
    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
