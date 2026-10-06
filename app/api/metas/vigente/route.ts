import { prisma } from '@/lib/prisma'
import { fechaDeHoy, fechaExiste } from '@/lib/dominio'
import { ok, manejarError, exigirSesion } from '@/lib/api'

/**
 * Meta vigente para un registro: primero la del cargo, si no la general.
 * El formulario la usa para proponer la meta del dia.
 */
export async function GET(request: Request) {
  try {
    await exigirSesion()
    const p = new URL(request.url).searchParams

    const proyectoId = Number(p.get('proyectoId'))
    const actividadId = Number(p.get('actividadId'))
    const cargoId = Number(p.get('cargoId'))
    const fechaTexto = p.get('fecha')

    if (!proyectoId || !actividadId) return ok(null)

    // Sin fecha (o mal escrita) se usa hoy en Colombia, como se guardan las fechas.
    const fecha =
      fechaTexto && fechaExiste(fechaTexto) ? new Date(`${fechaTexto}T00:00:00.000Z`) : fechaDeHoy()

    const vigencia = {
      vigenciaDesde: { lte: fecha },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fecha } }],
    }

    const especifica = cargoId
      ? await prisma.meta.findFirst({
          // Solo si trae m2 objetivo; si no, se usa la meta general.
          where: { proyectoId, actividadId, cargoId, m2Objetivo: { not: null }, ...vigencia },
          orderBy: { vigenciaDesde: 'desc' },
        })
      : null

    const meta =
      especifica ??
      (await prisma.meta.findFirst({
        where: { proyectoId, actividadId, cargoId: null, ...vigencia },
        orderBy: { vigenciaDesde: 'desc' },
      }))

    return ok(meta)
  } catch (error) {
    return manejarError(error)
  }
}
