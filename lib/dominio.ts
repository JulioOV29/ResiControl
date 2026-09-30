/**
 * Constantes del dominio: los valores validos de cada enumeracion y como se
 * escriben en pantalla.
 *
 * Vive aparte de lib/esquemas.ts a proposito. Los formularios necesitan estas
 * listas, y si las sacaran de esquemas.ts arrastrarian Zod entero al navegador
 * sin usarlo. Aqui no hay dependencias: son datos.
 */

export const ESTADOS_PROYECTO = ['PLANEACION', 'EN_EJECUCION', 'SUSPENDIDO', 'FINALIZADO'] as const
export const ESTADOS_EJECUCION = ['PENDIENTE', 'EN_PROCESO', 'TERMINADO', 'SUSPENDIDO'] as const
export const ROLES = ['ADMIN', 'RESIDENTE', 'SUPERVISOR'] as const

export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number]
export type EstadoEjecucion = (typeof ESTADOS_EJECUCION)[number]
export type Rol = (typeof ROLES)[number]

export const ETIQUETA_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
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
  SUPERVISOR: 'Supervisor: solo consulta e informes',
}

/** Opciones listas para un <select>, en el orden en que se muestran. */
export const opcionesEstadoProyecto = ESTADOS_PROYECTO.map((v) => ({
  valor: v,
  texto: ETIQUETA_ESTADO_PROYECTO[v],
}))

export const opcionesEstadoEjecucion = ESTADOS_EJECUCION.map((v) => ({
  valor: v,
  texto: ETIQUETA_ESTADO_EJECUCION[v],
}))

export const opcionesRol = ROLES.map((v) => ({ valor: v, texto: ETIQUETA_ROL[v] }))

// ---------------------------------------------------------------------------
//  Unidades de medida de las actividades
//
//  Las de uso corriente en obra. Se guarda el codigo corto ("m2", "ml"), que es
//  lo que se pinta al lado de cada cifra en tablas e indicadores; el texto
//  largo y los ejemplos solo viven en el desplegable, para que el residente
//  elija sin dudar.
//
//  El campo en la base sigue siendo texto y no un enum: las actividades que ya
//  existen conservan la unidad con la que se crearon, aunque un dia esta lista
//  cambie.
// ---------------------------------------------------------------------------

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

export type UnidadMedida = (typeof UNIDADES_MEDIDA)[number]['valor']

/**
 * Como se sabe cuanto hay que ejecutar en una obra, segun la unidad de su
 * actividad:
 *
 *   area     m2: largo x alto del elemento
 *   largo    ml: el largo del elemento
 *   captura  und, m3, kg: el elemento no lo dice (cuantos tomacorrientes lleva
 *            un muro no sale de sus medidas), asi que lo escribe el residente
 *            al abrir la obra
 */
export type ModoCantidad = 'area' | 'largo' | 'captura'

/** Normaliza la unidad guardada: "M2", "m²" y " m2 " son la misma. */
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

/**
 * La cantidad total que sale del elemento, o null si esa unidad no se puede
 * deducir de sus medidas y hay que capturarla.
 */
export function cantidadDelElemento(
  unidad: string | null | undefined,
  largo: number,
  alto: number,
): number | null {
  const modo = modoCantidad(unidad)
  if (modo === 'area') return Math.round(largo * alto * 100) / 100
  if (modo === 'largo') return largo
  return null
}

// ---------------------------------------------------------------------------
//  Permisos por rol
//
//  Viven aqui, junto a los demas datos del dominio, para que el servidor y el
//  navegador miren la misma tabla. En lib/auth.ts no pueden estar: ese modulo
//  arrastra Prisma y bcrypt, que no tienen nada que hacer en el cliente.
//
//  Ojo con lo que significa cada lado: en el navegador esto decide que botones
//  se ven, nada mas. La autorizacion de verdad la aplica cada API Route.
// ---------------------------------------------------------------------------

export const PERMISOS = {
  /** Crear, editar o borrar catalogos, obra, personal y metas. */
  gestionar: ['ADMIN', 'RESIDENTE'],
  /** Crear o editar registros de ejecucion. */
  registrar: ['ADMIN', 'RESIDENTE'],
  /** Administrar usuarios del sistema. */
  administrar: ['ADMIN'],
  /** Generar y consultar liquidaciones de pago. */
  liquidar: ['ADMIN', 'RESIDENTE'],
  /** Consultar dashboard e informes. */
  consultar: ['ADMIN', 'RESIDENTE', 'SUPERVISOR'],
} as const satisfies Record<string, readonly Rol[]>

export type Accion = keyof typeof PERMISOS

export function puede(rol: Rol | undefined | null, accion: Accion) {
  if (!rol) return false
  return (PERMISOS[accion] as readonly Rol[]).includes(rol)
}

// ---------------------------------------------------------------------------
//  Liquidaciones
// ---------------------------------------------------------------------------

export const PERIODOS_LIQUIDACION = ['MES', 'QUINCENA', 'RANGO'] as const
export type PeriodoLiquidacion = (typeof PERIODOS_LIQUIDACION)[number]

export const ETIQUETA_PERIODO: Record<PeriodoLiquidacion, string> = {
  MES: 'Mes',
  QUINCENA: 'Quincena',
  RANGO: 'Rango',
}

export const TIPOS_CUENTA = ['AHORROS', 'CORRIENTE'] as const

/** Ultimo dia de un mes: 28, 29, 30 o 31. `mes` va de 1 a 12. */
function ultimoDia(anio: number, mes: number) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Las fechas de un periodo de liquidacion, en aaaa-mm-dd.
 *
 *   MES       el mes completo: del 1 al ultimo dia
 *   QUINCENA  la primera (1 al 15) o la segunda (16 al ultimo dia)
 *   RANGO     las dos fechas tal como se eligieron
 *
 * Devuelve null mientras falte algo por elegir.
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
