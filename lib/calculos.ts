/**
 * Calculo de indicadores. Nada de esto se guarda en la base.
 *
 * Tres niveles:
 *   JORNADA  un registro (un dia de trabajo)
 *   OBRA     la cadena de registros de un mismo trabajo, hasta el 100%
 *   GLOBAL   varias jornadas de varias obras
 *
 * Un indicador global siempre es SUM(numerador) / SUM(denominador), nunca un
 * promedio de indicadores. El area de cada obra se cuenta una sola vez.
 */

/** Decimal de Prisma, texto o nulo -> number. */
export function num(valor: unknown): number {
  if (valor === null || valor === undefined) return 0
  if (typeof valor === 'number') return valor
  const n = Number(valor.toString())
  return Number.isNaN(n) ? 0 : n
}

/** Division que devuelve null si el denominador es 0. */
function dividir(numerador: number, denominador: number): number | null {
  if (!denominador || denominador <= 0) return null
  return numerador / denominador
}

// --- Horas: los campos TIME llegan como Date en UTC, se leen con metodos UTC ---

/** "07:30" -> Date para un campo TIME. */
export function horaADate(hora: string): Date {
  const [h, m] = hora.split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, h || 0, m || 0, 0))
}

/** Date de un campo TIME -> "07:30". */
export function dateAHora(valor: Date | string): string {
  const fecha = typeof valor === 'string' ? new Date(valor) : valor
  const h = String(fecha.getUTCHours()).padStart(2, '0')
  const m = String(fecha.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Minutos entre hora de inicio y hora final. */
function minutosJornada(inicio: Date | string, final: Date | string): number {
  const a = typeof inicio === 'string' ? new Date(inicio) : inicio
  const b = typeof final === 'string' ? new Date(final) : final
  return Math.round((b.getTime() - a.getTime()) / 60000)
}

/** Minutos trabajados: final - inicio - receso. */
function minutosEfectivos(
  inicio: Date | string,
  final: Date | string,
  recesoMin: number,
): number {
  return Math.max(0, minutosJornada(inicio, final) - (recesoMin || 0))
}

/** Minutos a "7h 30m". */
export function formatoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// --- Nivel 1: la jornada ---

/** Lo minimo de un registro para calcular su jornada. */
export interface JornadaCalculable {
  m2Ejecutados: unknown
  m2Meta?: unknown
  horaInicio: Date | string
  horaFinal: Date | string
  tiempoRecesoMin: number
}

export interface IndicadoresJornada {
  m2Ejecutados: number
  m2Meta: number
  minutosEfectivos: number
  horasEfectivas: number
  minutosReceso: number
  /** Cantidad por hora efectiva. */
  rendimiento: number | null
  /** Ejecutado del dia / meta del dia. */
  cumplimiento: number | null
}

export function indicadoresJornada(registro: JornadaCalculable): IndicadoresJornada {
  const m2Ejecutados = num(registro.m2Ejecutados)
  const m2Meta = num(registro.m2Meta)

  const minEfectivos = minutosEfectivos(
    registro.horaInicio,
    registro.horaFinal,
    registro.tiempoRecesoMin,
  )
  const horasEfectivas = minEfectivos / 60

  return {
    m2Ejecutados,
    m2Meta,
    minutosEfectivos: minEfectivos,
    horasEfectivas,
    minutosReceso: registro.tiempoRecesoMin || 0,
    rendimiento: dividir(m2Ejecutados, horasEfectivas),
    cumplimiento: dividir(m2Ejecutados, m2Meta),
  }
}

// --- Nivel 2: la obra (cadena de registros) ---

/** Registro que abre la obra, con sus avances. */
export interface ObraCalculable extends JornadaCalculable {
  largo?: unknown
  alto?: unknown
  cantidadTotal?: unknown
  avances?: JornadaCalculable[]
}

/** Cantidad total de la obra. Las obras viejas sin cantidad_total usan largo x alto. */
export function cantidadDeObra(apertura: {
  cantidadTotal?: unknown
  largo?: unknown
  alto?: unknown
}): number {
  if (apertura.cantidadTotal !== null && apertura.cantidadTotal !== undefined) {
    return num(apertura.cantidadTotal)
  }
  return num(apertura.largo) * num(apertura.alto)
}

export interface IndicadoresObra {
  jornadas: number
  m2Totales: number
  m2Ejecutados: number
  m2Pendientes: number
  horasEfectivas: number
  minutosReceso: number
  rendimiento: number | null
  /** Acumulado / cantidad total: llega al 100%. */
  avance: number
  completada: boolean
}

export function indicadoresObra(raiz: ObraCalculable): IndicadoresObra {
  const m2Totales = cantidadDeObra(raiz)
  const dias = [raiz as JornadaCalculable, ...(raiz.avances ?? [])]

  let m2Ejecutados = 0
  let horasEfectivas = 0
  let minutosReceso = 0

  for (const d of dias) {
    const i = indicadoresJornada(d)
    m2Ejecutados += i.m2Ejecutados
    horasEfectivas += i.horasEfectivas
    minutosReceso += i.minutosReceso
  }

  return {
    jornadas: dias.length,
    m2Totales,
    m2Ejecutados,
    m2Pendientes: Math.max(0, m2Totales - m2Ejecutados),
    horasEfectivas,
    minutosReceso,
    rendimiento: dividir(m2Ejecutados, horasEfectivas),
    avance: m2Totales > 0 ? m2Ejecutados / m2Totales : 0,
    // Tolerancia de media centesima por redondeo.
    completada: m2Totales > 0 && m2Ejecutados >= m2Totales - 0.005,
  }
}

// --- Nivel 3: varias obras ---

/** Jornada que sabe a que obra pertenece y cuanto mide la obra. */
export interface JornadaEncadenada extends JornadaCalculable {
  id: number
  registroOrigenId: number | null
  largo?: unknown
  alto?: unknown
  cantidadTotal?: unknown
  registroOrigen?: { largo?: unknown; alto?: unknown; cantidadTotal?: unknown } | null
}

/** Id de la obra de una jornada. */
export function claveDeObra(registro: Pick<JornadaEncadenada, 'id' | 'registroOrigenId'>) {
  return registro.registroOrigenId ?? registro.id
}

/** Cantidad total de la obra de una jornada. */
function areaDeObra(registro: JornadaEncadenada) {
  return cantidadDeObra(registro.registroOrigen ?? registro)
}

export interface EstadoObras {
  obras: number
  /** Cantidad total, una vez por obra. */
  m2Totales: number
  /** Ejecutado en toda la cadena, no solo en el periodo. */
  m2Acumulados: number
  m2Pendientes: number
  avance: number | null
  obrasTerminadas: number
}

/**
 * Avance y pendiente de un grupo de obras, usando sus cadenas completas.
 * El avance de un muro depende de todo lo hecho en el, no solo del periodo filtrado.
 */
function estadoDeObras(cadenas: JornadaEncadenada[]): EstadoObras {
  const area = new Map<number, number>()
  const hecho = new Map<number, number>()

  for (const r of cadenas) {
    const clave = claveDeObra(r)
    if (!area.has(clave)) area.set(clave, areaDeObra(r))
    hecho.set(clave, (hecho.get(clave) ?? 0) + num(r.m2Ejecutados))
  }

  let m2Totales = 0
  let m2Acumulados = 0
  let obrasTerminadas = 0

  for (const [clave, suArea] of area) {
    const suHecho = hecho.get(clave) ?? 0
    m2Totales += suArea
    m2Acumulados += suHecho
    if (suArea > 0 && suHecho >= suArea - 0.005) obrasTerminadas++
  }

  return {
    obras: area.size,
    m2Totales,
    m2Acumulados,
    m2Pendientes: Math.max(0, m2Totales - m2Acumulados),
    avance: dividir(m2Acumulados, m2Totales),
    obrasTerminadas,
  }
}

export interface IndicadoresAgregados extends EstadoObras {
  registros: number
  /** Ejecutado en las jornadas del periodo. */
  m2Ejecutados: number
  m2Meta: number
  /** Jornadas sin meta: no cuentan para el cumplimiento. */
  jornadasSinMeta: number
  horasEfectivas: number
  minutosReceso: number
  rendimiento: number | null
  cumplimiento: number | null
}

/**
 * Indicadores de un grupo de jornadas.
 * `registros`: jornadas del periodo (produccion, horas, rendimiento, cumplimiento).
 * `cadenas`: jornadas completas de esas obras (cantidad, avance, pendiente).
 * El cumplimiento solo usa las jornadas que tienen meta.
 */
export function agregarIndicadores(
  registros: JornadaEncadenada[],
  cadenas?: JornadaEncadenada[],
): IndicadoresAgregados {
  let m2Ejecutados = 0
  let m2ConMeta = 0
  let m2Meta = 0
  let jornadasSinMeta = 0
  let horasEfectivas = 0
  let minutosReceso = 0

  for (const r of registros) {
    const i = indicadoresJornada(r)
    m2Ejecutados += i.m2Ejecutados
    horasEfectivas += i.horasEfectivas
    minutosReceso += i.minutosReceso

    if (i.m2Meta > 0) {
      m2ConMeta += i.m2Ejecutados
      m2Meta += i.m2Meta
    } else {
      jornadasSinMeta++
    }
  }

  return {
    ...estadoDeObras(cadenas ?? registros),
    registros: registros.length,
    m2Ejecutados,
    m2Meta,
    jornadasSinMeta,
    horasEfectivas,
    minutosReceso,
    rendimiento: dividir(m2Ejecutados, horasEfectivas),
    cumplimiento: dividir(m2ConMeta, m2Meta),
  }
}

/** Agrupa jornadas por una clave (torre, actividad, cuadrilla...) y calcula cada grupo. */
export function agruparIndicadores<T extends JornadaEncadenada>(
  registros: T[],
  clave: (registro: T) => string,
  etiqueta?: (registro: T) => string,
  cadenas?: JornadaEncadenada[],
): Array<{ clave: string; etiqueta: string } & IndicadoresAgregados> {
  const grupos = new Map<string, { etiqueta: string; items: T[] }>()
  const grupoDeObra = new Map<number, string>()

  for (const registro of registros) {
    const k = clave(registro)
    if (!grupos.has(k)) {
      grupos.set(k, { etiqueta: etiqueta ? etiqueta(registro) : k, items: [] })
    }
    grupos.get(k)!.items.push(registro)
    // Cada obra queda en un solo grupo: su ubicacion y actividad no cambian.
    grupoDeObra.set(claveDeObra(registro), k)
  }

  // Las jornadas fuera del periodo se suman al grupo de su obra.
  const cadenasPorGrupo = new Map<string, JornadaEncadenada[]>()
  if (cadenas) {
    for (const r of cadenas) {
      const k = grupoDeObra.get(claveDeObra(r))
      if (!k) continue
      const lista = cadenasPorGrupo.get(k) ?? []
      lista.push(r)
      cadenasPorGrupo.set(k, lista)
    }
  }

  return Array.from(grupos.entries()).map(([k, grupo]) => ({
    clave: k,
    etiqueta: grupo.etiqueta,
    ...agregarIndicadores(grupo.items, cadenas ? (cadenasPorGrupo.get(k) ?? []) : undefined),
  }))
}
