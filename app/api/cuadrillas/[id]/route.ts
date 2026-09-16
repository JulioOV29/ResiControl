import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaCuadrilla } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Contexto) {
  try {
    await exigirSesion()
    const id = await idDeRuta(params)
    const cuadrilla = await prisma.cuadrilla.findUnique({
      where: { id },
      include: {
        proyecto: { select: { id: true, codigo: true, nombre: true } },
        integrantes: {
          orderBy: [{ activo: 'desc' }, { fechaInicio: 'desc' }],
          include: {
            trabajador: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                documento: true,
                cargo: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    })
    if (!cuadrilla) throw new ErrorApi(404, 'La cuadrilla no existe')
    return ok(cuadrilla)
  } catch (error) {
    return manejarError(error)
  }
}

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaCuadrilla.parse(await request.json())
    const actualizada = await prisma.cuadrilla.update({ where: { id }, data: datos })
    return ok(actualizada)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    await prisma.cuadrilla.delete({ where: { id } })
    return ok({ mensaje: 'Cuadrilla eliminada' })
  } catch (error) {
    return manejarError(error)
  }
}
