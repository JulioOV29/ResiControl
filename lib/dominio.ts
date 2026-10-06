/**
 * Valores validos de cada enumeracion y como se muestran.
 * Sin dependencias, para poder usarse en el navegador.
 */

export const ESTADOS_PROYECTO = ['PLANEACION', 'EN_EJECUCION', 'SUSPENDIDO', 'FINALIZADO'] as const
export const ESTADOS_EJECUCION = ['PENDIENTE', 'EN_PROCESO', 'TERMINADO', 'SUSPENDIDO'] as const
export const ROLES = ['ADMIN', 'RESIDENTE', 'SUPERVISOR'] as const

export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number]
export type EstadoEjecucion = (typeof ESTADOS_EJECUCION)[number]
export type Rol = (typeof ROLES)[number]

const ETIQUETA_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  PLANEACION: 'En planeacion',
  EN_EJECUCION: 'En ejecucion',
  SUSPENDIDO: 'Suspendido',
  FINALIZADO: 'Finalizado',
}

export const ETIQUETA_ESTADO_EJECUCION: Record<EstadoEjecucion, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  TERMINADO: 'Terminado',
  SUSPENDIDO: 'Suspendido',
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador: acceso total',
  RESIDENTE: 'Residente: registra ejecucion y gestiona obra',
  SUPERVISOR: 'Supervisor: solo consulta',
}

/** Opciones para un <select>. */
export const opcionesEstadoProyecto = ESTADOS_PROYECTO.map((v) => ({
  valor: v,
  texto: ETIQUETA_ESTADO_PROYECTO[v],
}))

export const opcionesEstadoEjecucion = ESTADOS_EJECUCION.map((v) => ({
  valor: v,
  texto: ETIQUETA_ESTADO_EJECUCION[v],
}))

export const opcionesRol = ROLES.map((v) => ({ valor: v, texto: ETIQUETA_ROL[v] }))

// --- Unidades de medida de las actividades ---

export const UNIDADES_MEDIDA = [
  {
    valor: 'm2',
    texto: 'm² · metro cuadrado',
    ejemplos: 'paredes, pisos, pintura, pañete, enchapes, formaletas',
  },
  {
    valor: 'm3',
    texto: 'm³ · metro cubico',
    ejemplos: 'excavaciones, concreto, rellenos',
  },
  {
    valor: 'ml',
    texto: 'ml · metro lineal',
    ejemplos: 'tuberias, cableado, bordillos, zocalos',
  },
  {
    valor: 'kg',
    texto: 'kg · kilogramo',
    ejemplos: 'acero de refuerzo, materiales a granel',
  },
  {
    valor: 'und',
    texto: 'und · unidad',
    ejemplos: 'puertas, ventanas, sanitarios, luminarias, tomacorrientes',
  },
] as const

/**
 * Como se obtiene la cantidad total de una obra segun la unidad:
 *   area     m2: largo x alto del elemento
 *   largo    ml: largo del elemento
 *   captura  und, m3, kg: la escribe el residente al abrir la obra
 */
export type ModoCantidad = 'area' | 'largo' | 'captura'

/** "M2", "m²" y " m2 " se tratan como "m2". */
export function normalizarUnidad(unidad: string | null | undefined): string {
  const u = (unidad ?? '').trim().toLowerCase().replace('²', '2').replace('³', '3')
  return u || 'm2'
}

export function modoCantidad(unidad: string | null | undefined): ModoCantidad {
  const u = normalizarUnidad(unidad)
  if (u === 'm2') return 'area'
  if (u === 'ml') return 'largo'
  return 'captura'
}

/** Suma de largo x ancho de los vanos, redondeada a centesimas. */
export function areaDeVanos(vanos: Array<{ largo: number | string; ancho: number | string }>) {
  const total = vanos.reduce((suma, v) => suma + Number(v.largo) * Number(v.ancho), 0)
  return Math.round(total * 100) / 100
}

/**
 * Cantidad que sale del elemento, o null si hay que escribirla.
 * En m2 es el area neta: largo x alto menos el area de los vanos.
 */
export function cantidadDelElemento(
  unidad: string | null | undefined,
  largo: number,
  alto: number,
  areaVanos = 0,
): number | null {
  const modo = modoCantidad(unidad)
  if (modo === 'area') return Math.round((largo * alto - areaVanos) * 100) / 100
  if (modo === 'largo') return largo
  return null
}

// --- Permisos por rol ---
// En el navegador solo deciden que botones se ven; la API los vuelve a validar.

export const PERMISOS = {
  /** Crear, editar o borrar catalogos, obra, personal y metas. */
  gestionar: ['ADMIN', 'RESIDENTE'],
  /** Crear o editar registros de obra. */
  registrar: ['ADMIN', 'RESIDENTE'],
  /** Administrar usuarios. */
  administrar: ['ADMIN'],
  /** Hacer y consultar liquidaciones. */
  liquidar: ['ADMIN', 'RESIDENTE'],
  /** Consultar el panel. */
  consultar: ['ADMIN', 'RESIDENTE', 'SUPERVISOR'],
} as const satisfies Record<string, readonly Rol[]>

export type Accion = keyof typeof PERMISOS

export function puede(rol: Rol | undefined | null, accion: Accion) {
  if (!rol) return false
  return (PERMISOS[accion] as readonly Rol[]).includes(rol)
}

// --- Liquidaciones ---

export const PERIODOS_LIQUIDACION = ['MES', 'QUINCENA', 'RANGO'] as const
export type PeriodoLiquidacion = (typeof PERIODOS_LIQUIDACION)[number]

export const ETIQUETA_PERIODO: Record<PeriodoLiquidacion, string> = {
  MES: 'Mes',
  QUINCENA: 'Quincena',
  RANGO: 'Rango',
}

export const TIPOS_CUENTA = ['AHORROS', 'CORRIENTE'] as const

/** Ultimo dia del mes (mes de 1 a 12). */
function ultimoDia(anio: number, mes: number) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Fechas de un periodo de liquidacion (aaaa-mm-dd):
 *   MES       del 1 al ultimo dia
 *   QUINCENA  del 1 al 15, o del 16 al ultimo dia
 *   RANGO     las fechas elegidas
 * Devuelve null si falta algun dato.
 */
export function fechasDePeriodo(
  tipo: PeriodoLiquidacion,
  datos: { mes?: string; quincena?: string; desde?: string; hasta?: string },
): { desde: string; hasta: string } | null {
  if (tipo === 'RANGO') {
    if (!datos.desde || !datos.hasta || datos.hasta < datos.desde) return null
    return { desde: datos.desde, hasta: datos.hasta }
  }
  const m = /^(\d{4})-(\d{2})$/.exec(datos.mes ?? '')
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2])
  const fin = ultimoDia(anio, mes)
  if (tipo === 'MES') return { desde: `${m[1]}-${m[2]}-01`, hasta: `${m[1]}-${m[2]}-${dos(fin)}` }
  if (datos.quincena === '1') return { desde: `${m[1]}-${m[2]}-01`, hasta: `${m[1]}-${m[2]}-15` }
  if (datos.quincena === '2') return { desde: `${m[1]}-${m[2]}-16`, hasta: `${m[1]}-${m[2]}-${dos(fin)}` }
  return null
}

/** Hoy en Colombia (aaaa-mm-dd), sin importar la zona horaria del servidor. */
export function hoyEnColombia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Hoy en Colombia como se guardan las fechas (medianoche UTC). */
export function fechaDeHoy() {
  return new Date(`${hoyEnColombia()}T00:00:00.000Z`)
}

/** true si aaaa-mm-dd es una fecha que existe (no 2026-02-31). */
export function fechaExiste(texto: string) {
  const fecha = new Date(`${texto}T00:00:00.000Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto
}

/** true si las fechas cuadran con el tipo de periodo (MES y QUINCENA son fijos). */
export function periodoCuadra(tipo: PeriodoLiquidacion, desde: string, hasta: string) {
  if (tipo === 'RANGO') return hasta >= desde
  const mes = desde.slice(0, 7)
  if (tipo === 'MES') {
    const esperado = fechasDePeriodo('MES', { mes })
    return esperado?.desde === desde && esperado.hasta === hasta
  }
  return ['1', '2'].some((quincena) => {
    const esperado = fechasDePeriodo('QUINCENA', { mes, quincena })
    return esperado?.desde === desde && esperado.hasta === hasta
  })
}
