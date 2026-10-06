import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaElemento } from '@/lib/esquemas'
import { areaDeVanos } from '@/lib/dominio'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const parametros = new URL(request.url).searchParams
    const zonaId = Number(parametros.get('zonaId'))

    const elementos = await prisma.elementoConstructivo.findMany({
      where: zonaId ? { zonaId } : undefined,
      orderBy: [{ codigoDwg: 'asc' }, { descripcion: 'asc' }],
      include: {
        zona: {
          select: {
            codigo: true,
            nombre: true,
            piso: {
              select: { numero: true, torre: { select: { codigo: true, nombre: true } } },
            },
          },
        },
        vanos: { orderBy: { id: 'asc' } },
        _count: { select: { registros: true } },
      },
    })
    return ok(elementos)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('gestionar')
    const { vanos = [], ...datos } = esquemaElemento.parse(await request.json())
    // El elemento y sus vanos se crean juntos; areaVanos guarda la suma.
    const creado = await prisma.elementoConstructivo.create({
      data: { ...datos, areaVanos: areaDeVanos(vanos), vanos: { create: vanos } },
      include: { vanos: true },
    })
    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
