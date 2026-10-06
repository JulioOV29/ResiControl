import { prisma } from '@/lib/prisma'
import { fechaDeHoy } from '@/lib/dominio'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaTarea } from '@/lib/esquemas'
import {
  relacionesTarea,
  siguienteCodigoDeTarea,
  validarCoherencia,
  validarTareaUnica,
  exigirPrecioAcordado,
} from '@/lib/consultas'
import { ESTADOS_EJECUCION } from '@/lib/dominio'
import type { EstadoEjecucion } from '@/lib/dominio'

/**
 * Tareas asignadas. Filtros:
 *   proyectoId  tareas de ese proyecto
 *   estado      PENDIENTE, EN_PROCESO, TERMINADO o SUSPENDIDO
 *   sinObra=1   solo las que aun no tienen registro de obra
 */
export async function GET(request: Request) {
  try {
    await exigirSesion()
    const parametros = new URL(request.url).searchParams

    const numero = (clave: string) => {
      const v = Number(parametros.get(clave))
      return Number.isInteger(v) && v > 0 ? v : null
    }

    const proyectoId = numero('proyectoId')
    const estado = parametros.get('estado')
    const sinObra = parametros.get('sinObra') === '1'

    const tareas = await prisma.tarea.findMany({
      where: {
        ...(proyectoId ? { elemento: { zona: { piso: { torre: { proyectoId } } } } } : {}),
        ...(estado && ESTADOS_EJECUCION.includes(estado as EstadoEjecucion)
          ? { estado: estado as EstadoEjecucion }
          : {}),
        // Tareas sin obra.
        ...(sinObra ? { registro: { is: null } } : {}),
      },
      orderBy: [{ estado: 'asc' }, { fechaInicioPlan: 'asc' }, { id: 'desc' }],
      include: relacionesTarea,
    })

    return ok(tareas)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    const sesion = await exigirPermiso('gestionar')
    const datos = esquemaTarea.parse(await request.json())

    // Una sola tarea por elemento y actividad.
    await validarTareaUnica(datos.elementoId, datos.actividadId)
    // El trabajador debe tener precio para la actividad.
    await exigirPrecioAcordado(datos.trabajadorId, datos.actividadId)

    // Cuadrilla del mismo proyecto y trabajador en esa cuadrilla en la fecha de inicio.
    await validarCoherencia({
      elementoId: datos.elementoId,
      cuadrillaId: datos.cuadrillaId,
      trabajadorId: datos.trabajadorId,
      fechaEjecucion: datos.fechaInicioPlan ?? fechaDeHoy(),
    })

    const creada = await prisma.tarea.create({
      data: {
        ...datos,
        // Una tarea nueva arranca pendiente, o suspendida si asi se pide.
        estado: datos.estado === 'SUSPENDIDO' ? 'SUSPENDIDO' : 'PENDIENTE',
        codigo: await siguienteCodigoDeTarea(),
        usuarioAsignaId: sesion.user.id,
      },
      include: relacionesTarea,
    })

    return ok(creada, 201)
  } catch (error) {
    return manejarError(error)
  }
}
