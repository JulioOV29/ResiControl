import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, ErrorApi } from '@/lib/api'
import { calcularLiquidacion } from '@/lib/liquidaciones'

const patronFecha = /^\d{4}-\d{2}-\d{2}$/

/**
 * Lo que se pagaria si se liquidara ahora: el mismo calculo que usa el
 * guardado, sin guardar nada. Trae ademas la ultima cuenta a la que se le
 * pago a ese trabajador, para proponerla.
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
    if (!patronFecha.test(desdeTexto) || !patronFecha.test(hastaTexto) || hastaTexto < desdeTexto) {
      throw new ErrorApi(400, 'El periodo no es valido')
    }

    const desde = new Date(`${desdeTexto}T00:00:00.000Z`)
    const hasta = new Date(`${hastaTexto}T00:00:00.000Z`)

    const [trabajador, ultima, calculo] = await Promise.all([
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
    ])
    if (!trabajador) throw new ErrorApi(404, 'El trabajador no existe')

    const { idsPagables, ...resto } = calculo
    void idsPagables

    return ok({ trabajador, ultimaCuenta: ultima, desde: desdeTexto, hasta: hastaTexto, ...resto })
  } catch (error) {
    return manejarError(error)
  }
}
