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

export interface EstadoObras {
  obras: number
  /** Area total de las obras, contada una sola vez por obra. */
  m2Totales: number
  /** Lo ejecutado en TODA la cadena, no solo en el periodo filtrado. */
  m2Acumulados: number
  m2Pendientes: number
  avance: number | null
  obrasTerminadas: number
}

/**
 * Estado de un conjunto de obras a partir de sus CADENAS COMPLETAS.
 *
 * Existe porque el avance y el pendiente no son indicadores de periodo: si el
 * filtro cubre una semana, lo producido esa semana es la produccion, pero lo
 * que falta de un muro depende de todo lo que se hizo en el, tambien antes del
 * lunes. Mezclarlos daba un pendiente inflado y un avance corto.
 *
 * Quien llama decide hasta donde llega la cadena: pasando solo las jornadas
 * hasta la fecha "hasta" del filtro se obtiene el estado al cierre del periodo.
 */
export function estadoDeObras(cadenas: JornadaEncadenada[]): EstadoObras {
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
    // Media centesima de tolerancia, como en indicadoresObra.
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
  /** Lo producido en las jornadas filtradas. */
  m2Ejecutados: number
  m2Meta: number
  /** Jornadas sin meta: quedan fuera del cumplimiento, pero no de lo demas. */
  jornadasSinMeta: number
  horasEfectivas: number
  minutosReceso: number
  rendimiento: number | null
  cumplimiento: number | null
}

/**
 * Agrega un conjunto de jornadas.
 *
 * `registros` son las jornadas del periodo: de ahi salen produccion, horas,
 * rendimiento y cumplimiento. `cadenas` son las jornadas completas de esas
 * mismas obras, y de ahi sale el estado (area, acumulado, pendiente, avance).
 * Si no se pasan cadenas se usan los propios registros, que es lo correcto
 * cuando no hay filtro de fechas de por medio.
 *
 * El cumplimiento solo mira las jornadas que tienen meta: sumar la produccion
 * de un dia sin meta contra la meta de otro dia da un cumplimiento inventado.
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

/**
 * Agrupa jornadas por una clave y calcula los indicadores de cada grupo. Es la
 * base de los cortes del panel: por torre, piso, zona, actividad, cuadrilla o
 * trabajador.
 */
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
    // Para repartir las cadenas: una obra pertenece siempre al mismo grupo,
    // porque su ubicacion y su actividad no cambian a mitad de la cadena.
    grupoDeObra.set(claveDeObra(registro), k)
  }

  // Las jornadas de fuera del periodo se llevan al grupo de su obra, para que
  // el area y el acumulado de cada corte sean los de la obra completa.
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
