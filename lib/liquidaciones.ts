/**
 * Calculo de una liquidacion: lo que se le debe a un trabajador en un lapso.
 * Lo usan la vista previa y el guardado, asi ambos dan lo mismo.
 *
 * - Se paga con el precio copiado en cada jornada, no con el actual.
 * - No entran jornadas ya pagadas ni jornadas sin precio (estas se avisan).
 * - Un renglon por actividad y precio.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { num } from '@/lib/calculos'

type Cliente = PrismaClient | Prisma.TransactionClient

/** Redondea a centavos. */
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
 * Id y codigo de una liquidacion nueva (LQ01, LQ02...). Salen de la secuencia
 * de la tabla: dos liquidaciones a la vez no chocan y un codigo anulado no se repite.
 */
export async function siguienteCodigoDeLiquidacion(cliente: Cliente = prisma) {
  const [fila] = await cliente.$queryRaw<Array<{ id: bigint }>>`
    SELECT nextval(pg_get_serial_sequence('liquidaciones', 'id_liquidacion')) AS id`
  const id = Number(fila.id)
  return { id, codigo: `LQ${String(id).padStart(2, '0')}` }
}

/** Relaciones de una liquidacion para mostrarla. */
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
