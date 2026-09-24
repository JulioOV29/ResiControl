import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso } from '@/lib/api'
import { esquemaTarea } from '@/lib/esquemas'
import { relacionesTarea, siguienteCodigoDeTarea, validarCoherencia } from '@/lib/consultas'
import { ESTADOS_EJECUCION } from '@/lib/dominio'
import type { EstadoEjecucion } from '@/lib/dominio'

/**
 * Las tareas asignadas.
 *
 * Filtros de la url:
 *   proyectoId, torreId   acotan por ubicacion, subiendo por la jerarquia
 *   estado                PENDIENTE, EN_PROCESO, TERMINADO o SUSPENDIDO
 *   sinObra=1             solo las que todavia no tienen registro de obra, que
 *                         es lo que ofrece el formulario de registro
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
    const torreId = numero('torreId')
    const estado = parametros.get('estado')
    const sinObra = parametros.get('sinObra') === '1'

    const tareas = await prisma.tarea.findMany({
      where: {
        ...(torreId
          ? { elemento: { zona: { piso: { torreId } } } }
          : proyectoId
            ? { elemento: { zona: { piso: { torre: { proyectoId } } } } }
            : {}),
        ...(estado && ESTADOS_EJECUCION.includes(estado as EstadoEjecucion)
          ? { estado: estado as EstadoEjecucion }
          : {}),
        // "is: null" es la forma de pedir las tareas sin obra abierta.
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

    // Las mismas reglas que una jornada: la cuadrilla tiene que ser del
    // proyecto del elemento, y el trabajador tiene que estar en esa cuadrilla en
    // la fecha prevista de inicio.
    await validarCoherencia({
      elementoId: datos.elementoId,
      cuadrillaId: datos.cuadrillaId,
      trabajadorId: datos.trabajadorId,
      fechaEjecucion: datos.fechaInicioPlan ?? new Date(),
    })

    const creada = await prisma.tarea.create({
      data: {
        ...datos,
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
