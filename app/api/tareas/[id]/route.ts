import { prisma } from '@/lib/prisma'
import { fechaDeHoy } from '@/lib/dominio'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaTarea } from '@/lib/esquemas'
import {
  relacionesTarea,
  validarCoherencia,
  validarTareaUnica,
  exigirPrecioAcordado,
  sincronizarEstadoTarea,
} from '@/lib/consultas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)

    const actual = await prisma.tarea.findUnique({
      where: { id },
      select: {
        elementoId: true,
        actividadId: true,
        trabajadorId: true,
        registro: { select: { codigoRegistro: true } },
      },
    })
    if (!actual) throw new ErrorApi(404, 'La tarea no existe')

    const datos = esquemaTarea.parse(await request.json())

    /** Si la tarea ya tiene obra, no se puede cambiar su elemento ni su actividad. */
    if (actual.registro) {
      const cambio =
        datos.elementoId !== actual.elementoId || datos.actividadId !== actual.actividadId

      if (cambio) {
        throw new ErrorApi(
          409,
          `La obra ${actual.registro.codigoRegistro} ya nacio de esta tarea: el elemento y la actividad ya no se pueden cambiar aqui.`,
        )
      }
    }

    await validarTareaUnica(datos.elementoId, datos.actividadId, id)
    if (datos.trabajadorId !== actual.trabajadorId || datos.actividadId !== actual.actividadId) {
      await exigirPrecioAcordado(datos.trabajadorId, datos.actividadId)
    }

    await validarCoherencia({
      elementoId: datos.elementoId,
      cuadrillaId: datos.cuadrillaId,
      trabajadorId: datos.trabajadorId,
      fechaEjecucion: datos.fechaInicioPlan ?? fechaDeHoy(),
    })

    // El estado lo da el avance de la obra; a mano solo se suspende o se reactiva.
    await prisma.tarea.update({
      where: { id },
      data: { ...datos, estado: datos.estado === 'SUSPENDIDO' ? 'SUSPENDIDO' : 'PENDIENTE' },
    })
    await sincronizarEstadoTarea(id)

    const actualizada = await prisma.tarea.findUniqueOrThrow({
      where: { id },
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

    // Una tarea con obra no se borra; se puede suspender.
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
