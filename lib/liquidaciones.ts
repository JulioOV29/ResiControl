/**
 * El calculo de una liquidacion: cuanto se le debe a un trabajador por lo que
 * ejecuto en un lapso.
 *
 * Una sola funcion sirve a la vista previa y al guardado, para que lo que el
 * residente ve antes de confirmar sea exactamente lo que se paga.
 *
 * Reglas:
 *   - Se paga con la tarifa CONGELADA en cada jornada (valor_m2), no con la
 *     vigente en la ficha del trabajador. Subirle el precio a alguien hoy no
 *     puede cambiar lo que valia el trabajo de la semana pasada.
 *   - Una jornada ya pagada (con id_liquidacion) no entra: no se paga dos veces.
 *   - Una jornada sin tarifa (el trabajador no tenia precio acordado para esa
 *     actividad cuando se registro) no entra, y se avisa: pagarla a cero
 *     callaria el problema.
 *   - Se agrupa por actividad y precio: si el precio del pañete cambio a mitad
 *     de la quincena, salen dos renglones y cada uno dice a cuanto se pago.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { num } from '@/lib/calculos'

type Cliente = PrismaClient | Prisma.TransactionClient

/** Redondeo a centavos, para que la suma de renglones cuadre con el total. */
const centavos = (valor: number) => Math.round(valor * 100) / 100

export interface LineaCalculada {
  actividadId: number
  actividadNombre: string
  unidad: string
  valorUnitario: number
  cantidad: number
  jornadas: number
  subtotal: number
}

export async function calcularLiquidacion(
  trabajadorId: number,
  desde: Date,
  hasta: Date,
  cliente: Cliente = prisma,
) {
  const jornadas = await cliente.registroEjecucion.findMany({
    where: { trabajadorId, fechaEjecucion: { gte: desde, lte: hasta } },
    orderBy: [{ fechaEjecucion: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      codigoRegistro: true,
      fechaEjecucion: true,
      m2Ejecutados: true,
      valorM2: true,
      liquidacionId: true,
      actividadId: true,
      actividad: { select: { nombre: true, unidadMedida: true } },
      elemento: { select: { codigoDwg: true, descripcion: true } },
      liquidacion: { select: { codigo: true } },
    },
  })

  const pagables = jornadas.filter((j) => j.liquidacionId === null && j.valorM2 !== null)
  const sinPrecio = jornadas.filter((j) => j.liquidacionId === null && j.valorM2 === null)
  const yaPagadas = jornadas.filter((j) => j.liquidacionId !== null)

  const grupos = new Map<string, LineaCalculada>()
  for (const j of pagables) {
    const valorUnitario = num(j.valorM2)
    const clave = `${j.actividadId}|${valorUnitario}`
    const linea = grupos.get(clave) ?? {
      actividadId: j.actividadId,
      actividadNombre: j.actividad.nombre,
      unidad: j.actividad.unidadMedida,
      valorUnitario,
      cantidad: 0,
      jornadas: 0,
      subtotal: 0,
    }
    linea.cantidad = centavos(linea.cantidad + num(j.m2Ejecutados))
    linea.jornadas += 1
    linea.subtotal = centavos(linea.subtotal + num(j.m2Ejecutados) * valorUnitario)
    grupos.set(clave, linea)
  }

  const lineas = [...grupos.values()].sort(
    (a, b) => a.actividadNombre.localeCompare(b.actividadNombre, 'es') || a.valorUnitario - b.valorUnitario,
  )
  const total = centavos(lineas.reduce((suma, l) => suma + l.subtotal, 0))

  const resumen = (j: (typeof jornadas)[number]) => ({
    id: j.id,
    codigoRegistro: j.codigoRegistro,
    fechaEjecucion: j.fechaEjecucion,
    actividad: j.actividad.nombre,
    unidad: j.actividad.unidadMedida,
    cantidad: num(j.m2Ejecutados),
    valorUnitario: j.valorM2 === null ? null : num(j.valorM2),
    subtotal: j.valorM2 === null ? null : centavos(num(j.m2Ejecutados) * num(j.valorM2)),
    elemento: `${j.elemento.codigoDwg} ${j.elemento.descripcion}`,
    liquidacion: j.liquidacion?.codigo ?? null,
  })

  return {
    lineas,
    total,
    jornadas: pagables.map(resumen),
    sinPrecio: sinPrecio.map(resumen),
    yaPagadas: yaPagadas.map(resumen),
    idsPagables: pagables.map((j) => j.id),
  }
}

/**
 * Codigo de una liquidacion nueva: LQ01, LQ02... Sobre el maximo existente,
 * para que anular una no haga repetir codigos.
 */
export async function siguienteCodigoDeLiquidacion(cliente: Cliente = prisma) {
  const existentes = await cliente.liquidacion.findMany({ select: { codigo: true } })
  const numeros = existentes
    .map((l) => Number(l.codigo.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n))
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1
  return `LQ${String(siguiente).padStart(2, '0')}`
}

/** Lo que acompaña a una liquidacion al mostrarla. */
export const relacionesLiquidacion = {
  trabajador: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      documento: true,
      cargo: { select: { nombre: true } },
    },
  },
  usuarioLiquida: { select: { id: true, nombre: true, apellido: true, email: true } },
  lineas: { orderBy: [{ actividadNombre: 'asc' }, { valorUnitario: 'asc' }] },
} as const satisfies Prisma.LiquidacionInclude
