import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, idDeRuta, ErrorApi, sinPrecios } from '@/lib/api'
import { esquemaCuadrilla } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Contexto) {
  try {
    const sesion = await exigirSesion()
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
                // Precios del trabajador: los formularios los usan para validar.
                tarifas: { select: { actividadId: true, valorM2: true } },
              },
            },
          },
        },
      },
    })
    if (!cuadrilla) throw new ErrorApi(404, 'La cuadrilla no existe')
    return ok(sinPrecios(cuadrilla, sesion.user.rol))
  } catch (error) {
    return manejarError(error)
  }
}

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaCuadrilla.parse(await request.json())

    // Con jornadas o tareas, la cuadrilla no cambia de proyecto.
    const actual = await prisma.cuadrilla.findUnique({
      where: { id },
      select: { proyectoId: true, _count: { select: { registros: true, tareas: true } } },
    })
    if (!actual) throw new ErrorApi(404, 'La cuadrilla no existe')
    if (
      actual.proyectoId !== datos.proyectoId &&
      actual._count.registros + actual._count.tareas > 0
    ) {
      throw new ErrorApi(
        409,
        'La cuadrilla ya tiene jornadas o tareas en su proyecto: no se puede pasar a otro proyecto',
      )
    }

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
