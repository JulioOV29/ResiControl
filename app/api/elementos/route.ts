import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaElemento } from '@/lib/esquemas'

export async function GET(request: Request) {
  try {
    await exigirSesion()
    const parametros = new URL(request.url).searchParams
    const zonaId = Number(parametros.get('zonaId'))
    const proyectoId = Number(parametros.get('proyectoId'))

    const elementos = await prisma.elementoConstructivo.findMany({
      where: zonaId
        ? { zonaId }
        : proyectoId
          ? { zona: { piso: { torre: { proyectoId } } } }
          : undefined,
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
    const datos = esquemaElemento.parse(await request.json())
    const creado = await prisma.elementoConstructivo.create({ data: datos })
    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
