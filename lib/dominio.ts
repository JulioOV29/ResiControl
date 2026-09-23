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
  /** Consultar dashboard e informes. */
  consultar: ['ADMIN', 'RESIDENTE', 'SUPERVISOR'],
} as const satisfies Record<string, readonly Rol[]>

export type Accion = keyof typeof PERMISOS

export function puede(rol: Rol | undefined | null, accion: Accion) {
  if (!rol) return false
  return (PERMISOS[accion] as readonly Rol[]).includes(rol)
}
