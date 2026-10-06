import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaAsignacion } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

/** Asigna un trabajador a la cuadrilla. Si estaba en otra, esa asignacion se cierra. */
export async function POST(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const cuadrillaId = await idDeRuta(params)
    const { trabajadorId, fechaInicio } = esquemaAsignacion.parse(await request.json())

    const yaEsta = await prisma.cuadrillaTrabajador.findFirst({
      where: { cuadrillaId, trabajadorId, activo: true },
    })
    if (yaEsta) throw new ErrorApi(409, 'El trabajador ya pertenece a esta cuadrilla')

    const dia = (f: Date) => f.toISOString().slice(0, 10)
    /** La asignacion anterior termina el dia antes de la nueva: nunca esta en dos a la vez. */
    const diaAnterior = new Date(fechaInicio.getTime() - 24 * 60 * 60 * 1000)

    const [actual, cruzada] = await Promise.all([
      prisma.cuadrillaTrabajador.findFirst({
        where: { trabajadorId, activo: true },
        select: { id: true, cuadrillaId: true, fechaInicio: true },
      }),
      // Asignaciones ya cerradas que terminan despues de que empieza la nueva.
      prisma.cuadrillaTrabajador.findFirst({
        where: { trabajadorId, activo: false, fechaFin: { gte: fechaInicio } },
        select: { fechaFin: true, cuadrilla: { select: { nombre: true } } },
      }),
    ])

    if (cruzada) {
      throw new ErrorApi(
        409,
        `El trabajador estuvo en ${cruzada.cuadrilla.nombre} hasta el ${dia(cruzada.fechaFin!)}: la nueva asignacion debe empezar despues`,
      )
    }

    if (actual) {
      if (fechaInicio <= actual.fechaInicio) {
        throw new ErrorApi(
          409,
          `Su asignacion actual empieza el ${dia(actual.fechaInicio)}: la nueva debe empezar despues`,
        )
      }
      // Sus jornadas en la cuadrilla actual no pueden quedar fuera de la asignacion.
      const jornada = await prisma.registroEjecucion.findFirst({
        where: { trabajadorId, cuadrillaId: actual.cuadrillaId, fechaEjecucion: { gte: fechaInicio } },
        orderBy: { fechaEjecucion: 'desc' },
        select: { codigoRegistro: true, fechaEjecucion: true },
      })
      if (jornada) {
        throw new ErrorApi(
          409,
          `Tiene la jornada ${jornada.codigoRegistro} del ${dia(jornada.fechaEjecucion)} en su cuadrilla actual: la nueva asignacion debe empezar despues de esa fecha`,
        )
      }
    }

    const asignacion = await prisma.$transaction(async (tx) => {
      if (actual) {
        await tx.cuadrillaTrabajador.update({
          where: { id: actual.id },
          data: { activo: false, fechaFin: diaAnterior },
        })
      }
      return tx.cuadrillaTrabajador.create({
        data: { cuadrillaId, trabajadorId, fechaInicio, activo: true },
      })
    })

    return ok(asignacion, 201)
  } catch (error) {
    return manejarError(error)
  }
}
