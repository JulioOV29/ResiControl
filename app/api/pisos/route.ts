import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaPiso } from '@/lib/esquemas'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const torreId = Number(new URL(request.url).searchParams.get('torreId'))
    const pisos = await prisma.piso.findMany({
      where: torreId ? { torreId } : undefined,
      orderBy: { numero: 'asc' },
      include: { _count: { select: { zonas: true } } },
    })
    return ok(pisos)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const datos = esquemaPiso.parse(await request.json())
    const creado = await prisma.piso.create({ data: datos })
    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
