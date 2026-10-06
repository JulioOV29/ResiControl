import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { normalizarUnidad } from '@/lib/dominio'
import { esquemaActividad } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const datos = esquemaActividad.parse(await request.json())

    // Con jornadas registradas, la unidad no cambia (mezclaria m2 con und en el panel).
    const actual = await prisma.actividad.findUnique({
      where: { id },
      select: { unidadMedida: true, _count: { select: { registros: true } } },
    })
    if (!actual) throw new ErrorApi(404, 'La actividad no existe')
    if (
      normalizarUnidad(actual.unidadMedida) !== normalizarUnidad(datos.unidadMedida) &&
      actual._count.registros > 0
    ) {
      throw new ErrorApi(
        409,
        `La actividad ya tiene ${actual._count.registros} jornadas en ${actual.unidadMedida}: la unidad no se puede cambiar. Crea otra actividad con la nueva unidad.`,
      )
    }

    const actualizada = await prisma.actividad.update({ where: { id }, data: datos })
    return ok(actualizada)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    await prisma.actividad.delete({ where: { id } })
    return ok({ mensaje: 'Actividad eliminada' })
  } catch (error) {
    return manejarError(error)
  }
}
