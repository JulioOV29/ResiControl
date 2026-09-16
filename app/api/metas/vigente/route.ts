import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion } from '@/lib/api'

/**
 * Meta aplicable a un registro concreto. Busca primero la meta especifica del
 * cargo y, si no hay, la general de la actividad. Sirve para que el formulario
 * proponga los m2 meta sin que el residente los tenga que recordar.
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

    const fecha = fechaTexto ? new Date(`${fechaTexto}T00:00:00.000Z`) : new Date()

    const vigencia = {
      vigenciaDesde: { lte: fecha },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fecha } }],
    }

    const especifica = cargoId
      ? await prisma.meta.findFirst({
          where: { proyectoId, actividadId, cargoId, ...vigencia },
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
