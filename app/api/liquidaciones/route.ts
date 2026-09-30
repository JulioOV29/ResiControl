import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, ErrorApi } from '@/lib/api'
import { esquemaLiquidacion } from '@/lib/esquemas'
import {
  calcularLiquidacion,
  relacionesLiquidacion,
  siguienteCodigoDeLiquidacion,
} from '@/lib/liquidaciones'

/**
 * Las liquidaciones hechas, de la mas reciente a la mas vieja.
 *
 * Filtros de la url: trabajadorId.
 *
 * Pide el permiso de liquidar y no solo sesion: aqui hay lo que se le paga a
 * cada persona y a que cuenta, y eso no es informacion de consulta general.
 */
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
 * Crea una liquidacion.
 *
 * El total se vuelve a calcular aqui, dentro de la transaccion, con las
 * jornadas que siguen sin pagar: si alguien pago una de ellas mientras el
 * residente miraba la vista previa, el marcado de abajo no la encuentra libre
 * y la liquidacion no se guarda. Asi una jornada no se paga dos veces.
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

      const liquidacion = await tx.liquidacion.create({
        data: {
          codigo: await siguienteCodigoDeLiquidacion(tx),
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

      // Solo las que siguen libres: si otra liquidacion se adelanto con alguna,
      // el conteo no cuadra y todo se deshace.
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
