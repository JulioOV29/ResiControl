import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combina clases de Tailwind sin conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Numero con separador de miles y coma decimal (es-CO). */
export function formatoNumero(valor: number | null | undefined, decimales = 2) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '-'
  return valor.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

/** Proporcion a porcentaje: 0.7037 -> 70,37 %. */
export function formatoPorcentaje(valor: number | null | undefined, decimales = 2) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '-'
  return `${formatoNumero(valor * 100, decimales)} %`
}

/** Valor en pesos, sin decimales. */
export function formatoMoneda(valor: number | null | undefined) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '-'
  return `$ ${formatoNumero(valor, 0)}`
}

/** Fecha a dd/mm/aaaa, leida en UTC para no correr el dia. */
export function formatoFecha(valor: Date | string | null | undefined) {
  if (!valor) return '-'
  const fecha = typeof valor === 'string' ? new Date(valor) : valor
  if (Number.isNaN(fecha.getTime())) return '-'
  const dia = String(fecha.getUTCDate()).padStart(2, '0')
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`
}

/**
 * Fecha y hora de un momento (createdAt...), en la hora de Colombia.
 * formatoFecha es para fechas sin hora, que la base guarda a medianoche UTC.
 */
export function formatoMomento(valor: Date | string | null | undefined) {
  if (!valor) return '-'
  const fecha = typeof valor === 'string' ? new Date(valor) : valor
  if (Number.isNaN(fecha.getTime())) return '-'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha)
}

/**
 * Fecha de hoy (aaaa-mm-dd) en la hora local.
 * No usar toISOString(): en Colombia, despues de las 7 p. m. daria manana.
 */
export function hoyTexto() {
  const ahora = new Date()
  const dosDigitos = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`
}

/**
 * Fecha a aaaa-mm-dd para los <input type="date">. Se lee en UTC
 * porque la base guarda las fechas a medianoche UTC.
 */
export function fechaParaInput(valor: Date | string | null | undefined) {
  if (!valor) return ''
  const fecha = typeof valor === 'string' ? new Date(valor) : valor
  if (Number.isNaN(fecha.getTime())) return ''
  return fecha.toISOString().slice(0, 10)
}

/** Codigo de la obra y numero de avance por separado: R40 y SR1. */
export function codigosDeRegistro(registro: {
  codigoRegistro: string
  registroOrigenId: number | null
  numeroAvance?: number | null
  registroOrigen?: { codigoRegistro: string } | null
}) {
  const esApertura = registro.registroOrigenId === null

  return {
    esApertura,
    obra: esApertura
      ? registro.codigoRegistro
      : (registro.registroOrigen?.codigoRegistro ?? registro.codigoRegistro.split('-')[0]),
    subregistro: esApertura ? null : `SR${registro.numeroAvance ?? ''}`,
  }
}
