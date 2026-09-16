import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combina clases de Tailwind resolviendo conflictos entre utilidades. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formatea un numero con separadores de miles y coma decimal (es-CO). */
export function formatoNumero(valor: number | null | undefined, decimales = 2) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '-'
  return valor.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

/** Formatea una proporcion (0.7037) como porcentaje (70,37 %). */
export function formatoPorcentaje(valor: number | null | undefined, decimales = 2) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '-'
  return `${formatoNumero(valor * 100, decimales)} %`
}

/**
 * Formatea un valor en pesos. Sin decimales a proposito: una tarifa de obra se
 * acuerda en pesos redondos y los centavos solo estorban la lectura.
 */
export function formatoMoneda(valor: number | null | undefined) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '-'
  return `$ ${formatoNumero(valor, 0)}`
}

/** Convierte una fecha a texto dd/mm/aaaa sin desfases de zona horaria. */
export function formatoFecha(valor: Date | string | null | undefined) {
  if (!valor) return '-'
  const fecha = typeof valor === 'string' ? new Date(valor) : valor
  if (Number.isNaN(fecha.getTime())) return '-'
  const dia = String(fecha.getUTCDate()).padStart(2, '0')
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`
}

/** Convierte una fecha al formato aaaa-mm-dd que usan los inputs date. */
export function fechaParaInput(valor: Date | string | null | undefined) {
  if (!valor) return ''
  const fecha = typeof valor === 'string' ? new Date(valor) : valor
  if (Number.isNaN(fecha.getTime())) return ''
  return fecha.toISOString().slice(0, 10)
}

/**
 * Como se muestra un registro en la lista: el codigo de la obra y, si es un
 * subregistro, su numero dentro de ella. R40 va en una columna y SR1 en la de
 * al lado, para que se vea de un golpe a que obra pertenece cada avance.
 */
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
