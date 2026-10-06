import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, ErrorApi } from '@/lib/api'
import { calcularLiquidacion } from '@/lib/liquidaciones'
import { fechaExiste } from '@/lib/dominio'

const patronFecha = /^\d{4}-\d{2}-\d{2}$/

/**
 * Vista previa: el mismo calculo del guardado, sin guardar.
 * Incluye la ultima cuenta usada con el trabajador.
 */
export async function GET(request: Request) {
  try {
    await exigirPermiso('liquidar')
    const p = new URL(request.url).searchParams
    const trabajadorId = Number(p.get('trabajadorId'))
    const desdeTexto = p.get('desde') ?? ''
    const hastaTexto = p.get('hasta') ?? ''

    if (!Number.isInteger(trabajadorId) || trabajadorId <= 0) {
      throw new ErrorApi(400, 'Selecciona un trabajador')
    }
    if (
      !patronFecha.test(desdeTexto) ||
      !patronFecha.test(hastaTexto) ||
      !fechaExiste(desdeTexto) ||
      !fechaExiste(hastaTexto) ||
      hastaTexto < desdeTexto
    ) {
      throw new ErrorApi(400, 'El periodo no es valido')
    }

    const desde = new Date(`${desdeTexto}T00:00:00.000Z`)
    const hasta = new Date(`${hastaTexto}T00:00:00.000Z`)

    const [trabajador, ultima, calculo, anteriores] = await Promise.all([
      prisma.trabajador.findUnique({
        where: { id: trabajadorId },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          documento: true,
          cargo: { select: { nombre: true } },
        },
      }),
      prisma.liquidacion.findFirst({
        where: { trabajadorId },
        orderBy: { createdAt: 'desc' },
        select: { banco: true, tipoCuenta: true, numeroCuenta: true },
      }),
      calcularLiquidacion(trabajadorId, desde, hasta),
      // Jornadas sin pagar de antes del lapso (por ejemplo, registradas tarde).
      prisma.registroEjecucion.aggregate({
        where: { trabajadorId, liquidacionId: null, fechaEjecucion: { lt: desde } },
        _count: { _all: true },
        _min: { fechaEjecucion: true },
      }),
    ])
    if (!trabajador) throw new ErrorApi(404, 'El trabajador no existe')

    const { idsPagables, ...resto } = calculo
    void idsPagables

    return ok({
      trabajador,
      ultimaCuenta: ultima,
      desde: desdeTexto,
      hasta: hastaTexto,
      ...resto,
      pendientesAnteriores: {
        jornadas: anteriores._count._all,
        desde: anteriores._min.fechaEjecucion,
      },
    })
  } catch (error) {
    return manejarError(error)
  }
}
