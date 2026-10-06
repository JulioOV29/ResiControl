import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, ErrorApi } from '@/lib/api'
import { esquemaLiquidacion } from '@/lib/esquemas'
import {
  calcularLiquidacion,
  relacionesLiquidacion,
  siguienteCodigoDeLiquidacion,
} from '@/lib/liquidaciones'

/** Liquidaciones, de la mas reciente a la mas antigua. Filtro: trabajadorId. */
export async function GET(request: Request) {
  try {
    await exigirPermiso('liquidar')
    const parametros = new URL(request.url).searchParams
    const trabajadorId = Number(parametros.get('trabajadorId'))

    const liquidaciones = await prisma.liquidacion.findMany({
      where: Number.isInteger(trabajadorId) && trabajadorId > 0 ? { trabajadorId } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        trabajador: relacionesLiquidacion.trabajador,
        usuarioLiquida: relacionesLiquidacion.usuarioLiquida,
        _count: { select: { registros: true } },
      },
    })
    return ok(liquidaciones)
  } catch (error) {
    return manejarError(error)
  }
}

/**
 * Crea una liquidacion. El total se recalcula dentro de la transaccion
 * y las jornadas se marcan como pagadas solo si siguen libres.
 */
export async function POST(request: Request) {
  try {
    const sesion = await exigirPermiso('liquidar')
    const datos = esquemaLiquidacion.parse(await request.json())

    const trabajador = await prisma.trabajador.findUnique({
      where: { id: datos.trabajadorId },
      select: { nombre: true, apellido: true },
    })
    if (!trabajador) throw new ErrorApi(404, 'El trabajador no existe')

    const creada = await prisma.$transaction(async (tx) => {
      // Bloquea las jornadas pendientes del lapso: nadie las edita ni las borra mientras se paga.
      await tx.$queryRaw`
        SELECT id_ejecucion FROM registros_ejecucion
        WHERE id_trabajador = ${datos.trabajadorId}
          AND fecha_ejecucion BETWEEN ${datos.desde.toISOString().slice(0, 10)}::date
                                  AND ${datos.hasta.toISOString().slice(0, 10)}::date
          AND id_liquidacion IS NULL
        ORDER BY id_ejecucion
        FOR UPDATE`

      const calculo = await calcularLiquidacion(datos.trabajadorId, datos.desde, datos.hasta, tx)

      if (calculo.idsPagables.length === 0 || calculo.total <= 0) {
        throw new ErrorApi(
          409,
          `${trabajador.nombre} ${trabajador.apellido} no tiene jornadas con precio pendientes de pago en ese lapso`,
        )
      }

      if (
        datos.totalEsperado !== undefined &&
        Math.abs(datos.totalEsperado - calculo.total) > 0.005
      ) {
        throw new ErrorApi(
          409,
          'Las jornadas de ese lapso cambiaron mientras se revisaba: el total ya no es el que se confirmo. Revisa la vista previa y vuelve a liquidar.',
        )
      }

      const { id, codigo } = await siguienteCodigoDeLiquidacion(tx)
      const liquidacion = await tx.liquidacion.create({
        data: {
          id,
          codigo,
          trabajadorId: datos.trabajadorId,
          tipoPeriodo: datos.tipoPeriodo,
          desde: datos.desde,
          hasta: datos.hasta,
          total: calculo.total,
          banco: datos.banco,
          tipoCuenta: datos.tipoCuenta,
          numeroCuenta: datos.numeroCuenta,
          observaciones: datos.observaciones,
          usuarioLiquidaId: sesion.user.id,
          lineas: { create: calculo.lineas },
        },
      })

      // Si otra liquidacion tomo alguna jornada, el conteo no cuadra y se deshace todo.
      const marcadas = await tx.registroEjecucion.updateMany({
        where: { id: { in: calculo.idsPagables }, liquidacionId: null },
        data: { liquidacionId: liquidacion.id },
      })
      if (marcadas.count !== calculo.idsPagables.length) {
        throw new ErrorApi(
          409,
          'Algunas jornadas se acaban de pagar en otra liquidacion. Vuelve a abrir la vista previa.',
        )
      }

      return tx.liquidacion.findUniqueOrThrow({
        where: { id: liquidacion.id },
        include: relacionesLiquidacion,
      })
    }, { timeout: 20_000 })

    return ok(creada, 201)
  } catch (error) {
    return manejarError(error)
  }
}
