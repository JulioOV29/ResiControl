import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaTarea } from '@/lib/esquemas'
import { relacionesTarea, validarCoherencia } from '@/lib/consultas'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Contexto) {
  try {
    await exigirSesion()
    const id = await idDeRuta(params)
    const tarea = await prisma.tarea.findUnique({ where: { id }, include: relacionesTarea })
    if (!tarea) throw new ErrorApi(404, 'La tarea no existe')
    return ok(tarea)
  } catch (error) {
    return manejarError(error)
  }
}

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)

    const actual = await prisma.tarea.findUnique({
      where: { id },
      select: {
        frenteId: true,
        actividadId: true,
        largo: true,
        alto: true,
        registro: { select: { codigoRegistro: true } },
      },
    })
    if (!actual) throw new ErrorApi(404, 'La tarea no existe')

    const datos = esquemaTarea.parse(await request.json())

    /**
     * Si la obra ya arranco, el encargo ya se materializo: cambiarle la
     * ubicacion, la actividad o las medidas dejaria la tarea diciendo una cosa
     * y lo ejecutado otra. Lo que si se puede corregir es a quien se le asigna,
     * las fechas previstas, la meta, el estado y las observaciones.
     */
    if (actual.registro) {
      const cambio =
        datos.frenteId !== actual.frenteId ||
        datos.actividadId !== actual.actividadId ||
        datos.largo !== Number(String(actual.largo)) ||
        datos.alto !== Number(String(actual.alto))

      if (cambio) {
        throw new ErrorApi(
          409,
          `La obra ${actual.registro.codigoRegistro} ya nacio de esta tarea: la ubicacion, la actividad y las medidas ya no se pueden cambiar aqui. Corrigelas en el registro de obra.`,
        )
      }
    }

    await validarCoherencia({
      frenteId: datos.frenteId,
      cuadrillaId: datos.cuadrillaId,
      trabajadorId: datos.trabajadorId,
      fechaEjecucion: datos.fechaInicioPlan ?? new Date(),
    })

    const actualizada = await prisma.tarea.update({
      where: { id },
      data: datos,
      include: relacionesTarea,
    })
    return ok(actualizada)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)

    const tarea = await prisma.tarea.findUnique({
      where: { id },
      select: { codigo: true, registro: { select: { codigoRegistro: true } } },
    })
    if (!tarea) throw new ErrorApi(404, 'La tarea no existe')

    // Borrar una tarea con obra abierta dejaria la obra sin de donde viene. Si
    // el trabajo se cancela, la tarea se suspende; si se asigno por error y no
    // se ha ejecutado nada, entonces si se borra.
    if (tarea.registro) {
      throw new ErrorApi(
        409,
        `No se puede eliminar: de esta tarea ya nacio la obra ${tarea.registro.codigoRegistro}. Si el trabajo se cancelo, dejala en estado Suspendido.`,
      )
    }

    await prisma.tarea.delete({ where: { id } })
    return ok({ mensaje: `Tarea ${tarea.codigo} eliminada` })
  } catch (error) {
    return manejarError(error)
  }
}
