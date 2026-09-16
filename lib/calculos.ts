/**
 * Motor de indicadores del sistema.
 *
 * Ningun indicador se almacena en la base: todos se derivan aqui, para que
 * exista una sola definicion de cada formula y el panel, la pantalla de
 * ejecucion y los informes no puedan discrepar entre si.
 *
 * Hay tres niveles, y confundirlos es la fuente de casi todos los errores:
 *
 *   JORNADA  un registro: lo producido y el tiempo de un dia concreto
 *   OBRA     la cadena de registros de un mismo trabajo, que avanza hasta 100%
 *   GLOBAL   un conjunto de jornadas de varias obras
 *
 * Regla de agregacion: un indicador global NUNCA se obtiene promediando ni
 * sumando indicadores individuales, siempre es SUM(numerador)/SUM(denominador).
 *
 * Regla de la cantidad total: las dimensiones las lleva el registro que abre la
 * obra. Al agregar, el area de cada obra se cuenta UNA sola vez aunque el
 * trabajo se haya repartido en diez dias.
 */

/** Numero, Decimal de Prisma, texto o nulo -> numero plano. */
export function num(valor: unknown): number {
  if (valor === null || valor === undefined) return 0
  if (typeof valor === 'number') return valor
  const n = Number(valor.toString())
  return Number.isNaN(n) ? 0 : n
}

/** Division segura: devuelve null cuando el denominador no aporta informacion. */
export function dividir(numerador: number, denominador: number): number | null {
  if (!denominador || denominador <= 0) return null
  return numerador / denominador
}

// ---------------------------------------------------------------------------
//  Horas. hora_inicio y hora_final son TIME en PostgreSQL y Prisma los entrega
//  como Date fijados al 1970-01-01 en UTC, asi que se leen y escriben siempre
//  con los metodos UTC: la hora que se guarda es la que se ve.
// ---------------------------------------------------------------------------

/** "07:30" -> Date apto para un campo TIME de PostgreSQL. */
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

/** Minutos brutos entre la hora de inicio y la hora final. */
export function minutosJornada(inicio: Date | string, final: Date | string): number {
  const a = typeof inicio === 'string' ? new Date(inicio) : inicio
  const b = typeof final === 'string' ? new Date(final) : final
  return Math.round((b.getTime() - a.getTime()) / 60000)
}

/** tiempo_efectivo = hora_final - hora_inicio - tiempo_receso */
export function minutosEfectivos(
  inicio: Date | string,
  final: Date | string,
  recesoMin: number,
): number {
  return Math.max(0, minutosJornada(inicio, final) - (recesoMin || 0))
}

/** Minutos a formato "7h 30m". */
export function formatoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ---------------------------------------------------------------------------
//  Nivel 1: la jornada
// ---------------------------------------------------------------------------

/** Forma minima de un registro para poder calcular su jornada. */
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
  /** m2 por hora efectiva. */
  rendimiento: number | null
  /** ejecutado del dia sobre la meta del dia. */
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

// ---------------------------------------------------------------------------
//  Nivel 2: la obra, es decir la cadena de registros
// ---------------------------------------------------------------------------

/** El registro que abre la obra, con sus avances colgando. */
export interface ObraCalculable extends JornadaCalculable {
  largo?: unknown
  alto?: unknown
  avances?: JornadaCalculable[]
}

export interface IndicadoresObra {
  jornadas: number
  m2Totales: number
  m2Ejecutados: number
  m2Pendientes: number
  horasEfectivas: number
  minutosReceso: number
  rendimiento: number | null
  /** acumulado sobre el area del elemento: esto es lo que llega al 100%. */
  avance: number
  completada: boolean
}

export function indicadoresObra(raiz: ObraCalculable): IndicadoresObra {
  const m2Totales = num(raiz.largo) * num(raiz.alto)
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
    // Con media centesima de tolerancia, para que un redondeo no deje una obra
    // en 99,99% cuando en el terreno ya esta terminada.
    completada: m2Totales > 0 && m2Ejecutados >= m2Totales - 0.005,
  }
}

// ---------------------------------------------------------------------------
//  Nivel 3: agregados
// ---------------------------------------------------------------------------

/** Una jornada que sabe a que obra pertenece y cuanto mide esa obra. */
export interface JornadaEncadenada extends JornadaCalculable {
  id: number
  registroOrigenId: number | null
  largo?: unknown
  alto?: unknown
  registroOrigen?: { largo?: unknown; alto?: unknown } | null
}

/** Identificador de la obra a la que pertenece una jornada. */
export function claveDeObra(registro: Pick<JornadaEncadenada, 'id' | 'registroOrigenId'>) {
  return registro.registroOrigenId ?? registro.id
}

/** Area del elemento de la obra: la lleva el registro que la abrio. */
export function areaDeObra(registro: JornadaEncadenada) {
  const origen = registro.registroOrigen
  if (origen) return num(origen.largo) * num(origen.alto)
  return num(registro.largo) * num(registro.alto)
}

export interface IndicadoresAgregados {
  registros: number
  obras: number
  m2Totales: number
  m2Ejecutados: number
  m2Pendientes: number
  m2Meta: number
  horasEfectivas: number
  minutosReceso: number
  rendimiento: number | null
  cumplimiento: number | null
  avance: number | null
}

/**
 * Agrega un conjunto de jornadas. Los numeradores se suman jornada a jornada,
 * pero el area se suma UNA vez por obra: si el mismo muro se trabajo cinco
 * dias, su area no puede contar cinco veces.
 */
export function agregarIndicadores(registros: JornadaEncadenada[]): IndicadoresAgregados {
  const areaPorObra = new Map<number, number>()

  let m2Ejecutados = 0
  let m2Meta = 0
  let horasEfectivas = 0
  let minutosReceso = 0

  for (const r of registros) {
    const i = indicadoresJornada(r)
    m2Ejecutados += i.m2Ejecutados
    m2Meta += i.m2Meta
    horasEfectivas += i.horasEfectivas
    minutosReceso += i.minutosReceso

    const clave = claveDeObra(r)
    if (!areaPorObra.has(clave)) areaPorObra.set(clave, areaDeObra(r))
  }

  const m2Totales = Array.from(areaPorObra.values()).reduce((a, b) => a + b, 0)

  return {
    registros: registros.length,
    obras: areaPorObra.size,
    m2Totales,
    m2Ejecutados,
    m2Pendientes: Math.max(0, m2Totales - m2Ejecutados),
    m2Meta,
    horasEfectivas,
    minutosReceso,
    rendimiento: dividir(m2Ejecutados, horasEfectivas),
    cumplimiento: dividir(m2Ejecutados, m2Meta),
    avance: dividir(m2Ejecutados, m2Totales),
  }
}

/**
 * Agrupa jornadas por una clave y calcula los indicadores de cada grupo. Es la
 * base de los cortes del panel: por torre, piso, zona, actividad, cuadrilla o
 * trabajador.
 */
export function agruparIndicadores<T extends JornadaEncadenada>(
  registros: T[],
  clave: (registro: T) => string,
  etiqueta?: (registro: T) => string,
): Array<{ clave: string; etiqueta: string } & IndicadoresAgregados> {
  const grupos = new Map<string, { etiqueta: string; items: T[] }>()

  for (const registro of registros) {
    const k = clave(registro)
    if (!grupos.has(k)) {
      grupos.set(k, { etiqueta: etiqueta ? etiqueta(registro) : k, items: [] })
    }
    grupos.get(k)!.items.push(registro)
  }

  return Array.from(grupos.entries()).map(([k, grupo]) => ({
    clave: k,
    etiqueta: grupo.etiqueta,
    ...agregarIndicadores(grupo.items),
  }))
}
