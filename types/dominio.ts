/**
 * Formas que viajan del servidor al cliente. Son las entidades de Prisma ya
 * serializadas: los Decimal llegan como number y las fechas como texto ISO.
 */

export type EstadoProyecto = 'PLANEACION' | 'EN_EJECUCION' | 'SUSPENDIDO' | 'FINALIZADO'
export type EstadoEjecucion = 'PENDIENTE' | 'EN_PROCESO' | 'TERMINADO' | 'SUSPENDIDO'
export type Rol = 'ADMIN' | 'RESIDENTE' | 'SUPERVISOR'

export interface Proyecto {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  fechaInicio: string | null
  fechaFin: string | null
  estado: EstadoProyecto
  _count?: { torres: number; cuadrillas: number; metas: number }
}

export interface Torre {
  id: number
  proyectoId: number
  codigo: string
  nombre: string
  descripcion: string | null
  estado: EstadoEjecucion
  proyecto?: { codigo: string; nombre: string }
  _count?: { pisos: number }
}

export interface Piso {
  id: number
  torreId: number
  numero: number
  nombre: string | null
  descripcion: string | null
  _count?: { zonas: number }
}

export interface Zona {
  id: number
  pisoId: number
  codigo: string
  nombre: string
  tipo: string | null
  descripcion: string | null
  _count?: { frentes: number }
}

export interface Frente {
  id: number
  zonaId: number
  codigoDwg: string
  descripcion: string
  unidad: string | null
  estado: EstadoEjecucion
  zona?: {
    codigo: string
    nombre: string
    piso: { numero: number; torre: { codigo: string; nombre: string } }
  }
  _count?: { registros: number }
}

/** Ubicacion completa de un frente, tal como la devuelven los registros. */
export interface FrenteUbicado {
  id: number
  codigoDwg: string
  descripcion: string
  unidad: string | null
  zona: {
    id: number
    codigo: string
    nombre: string
    piso: {
      id: number
      numero: number
      nombre: string | null
      torre: {
        id: number
        codigo: string
        nombre: string
        proyecto: { id: number; codigo: string; nombre: string }
      }
    }
  }
}

export interface Actividad {
  id: number
  nombre: string
  unidadMedida: string
  descripcion: string | null
  activo: boolean
  _count?: { registros: number; metas: number; tarifas?: number }
}

export interface Cargo {
  id: number
  nombre: string
  descripcion: string | null
  _count?: { trabajadores: number }
}

/** Lo que se le paga a un trabajador por metro de una actividad. */
export interface Tarifa {
  id?: number
  actividadId: number
  valorM2: number
  actividad?: { id: number; nombre: string; unidadMedida: string }
}

export interface Trabajador {
  id: number
  documento: string | null
  nombre: string
  apellido: string
  cargoId: number
  activo: boolean
  cargo?: { id: number; nombre: string }
  asignaciones?: Array<{ id: number; cuadrilla: { id: number; nombre: string } }>
  /** Sus precios por metro, uno por actividad. */
  tarifas?: Tarifa[]
}

export interface Cuadrilla {
  id: number
  proyectoId: number
  nombre: string
  descripcion: string | null
  activo: boolean
  proyecto?: { id: number; codigo: string; nombre: string }
  integrantes?: Asignacion[]
  _count?: { integrantes: number; registros: number }
}

export interface Asignacion {
  id: number
  cuadrillaId: number
  trabajadorId: number
  fechaInicio: string
  fechaFin: string | null
  activo: boolean
  trabajador?: {
    id: number
    nombre: string
    apellido: string
    documento: string | null
    cargo: { id: number; nombre: string }
    /** Sus precios por metro: con ellos el formulario de registro sabe si la
     * jornada va a quedar con importe o sin el. */
    tarifas?: Array<{ actividadId: number; valorM2: number }>
  }
}

export interface Meta {
  id: number
  proyectoId: number
  actividadId: number
  cargoId: number | null
  rendimientoObjetivo: number | null
  m2Objetivo: number | null
  vigenciaDesde: string
  vigenciaHasta: string | null
  proyecto?: { id: number; codigo: string; nombre: string }
  actividad?: { id: number; nombre: string; unidadMedida: string }
  cargo?: { id: number; nombre: string } | null
}

export interface Usuario {
  id: number
  nombre: string
  apellido: string
  email: string
  rol: Rol
  activo: boolean
  createdAt: string
}

/** Referencia corta a otro registro de la misma obra. */
export interface ReferenciaRegistro {
  id: number
  codigoRegistro: string
  numeroAvance?: number | null
  fechaEjecucion: string
  m2Ejecutados?: number
  largo?: number | null
  alto?: number | null
}

export interface Registro {
  id: number
  codigoRegistro: string
  fechaEjecucion: string
  frenteId: number
  actividadId: number
  cuadrillaId: number
  trabajadorId: number | null
  /** El dia anterior de esta obra. Nulo si este registro la abrio. */
  registroAnteriorId: number | null
  /** El registro que abrio la obra. Nulo si este es ese registro. */
  registroOrigenId: number | null
  /** La tarea de la que nacio la obra. Solo la lleva la apertura. */
  tareaId: number | null
  tarea?: { id: number; codigo: string } | null
  /** Numero del subregistro dentro de su obra: 1, 2, 3. Nulo en la apertura. */
  numeroAvance: number | null
  /** Medidas del elemento. Solo las lleva el registro que abre la obra. */
  largo: number | null
  alto: number | null
  m2Ejecutados: number
  horaInicio: string
  horaFinal: string
  tiempoRecesoMin: number
  m2Meta: number | null
  /** Tarifa que tenia el trabajador para esa actividad cuando se guardo. */
  valorM2: number | null
  observaciones: string | null
  frente?: FrenteUbicado
  actividad?: { id: number; nombre: string; unidadMedida: string }
  cuadrilla?: { id: number; nombre: string }
  trabajador?: {
    id: number
    nombre: string
    apellido: string
    cargo: { id: number; nombre: string }
  } | null
  usuarioRegistra?: { id: number; nombre: string; apellido: string }
  registroAnterior?: ReferenciaRegistro | null
  registroOrigen?: ReferenciaRegistro | null
  continuacion?: { id: number; codigoRegistro: string; fechaEjecucion: string } | null
}

/** Una obra: el registro que la abrio, con toda su cadena de avances. */
export interface Obra extends Registro {
  avances: Array<{
    id: number
    codigoRegistro: string
    fechaEjecucion: string
    m2Ejecutados: number
    horaInicio: string
    horaFinal: string
    tiempoRecesoMin: number
    m2Meta: number | null
    registroAnteriorId: number | null
    numeroAvance: number | null
  }>
  resumen: {
    total: number
    ejecutado: number
    pendiente: number
    avance: number
    completada: boolean
    jornadas: number
    horasEfectivas: number
    rendimiento: number | null
    ultimoId: number
    ultimoCodigo: string
  }
}

/**
 * Los catalogos que llenan los desplegables de filtro, tal como los entrega
 * /api/catalogos: solo los campos que se pintan, y la jerarquia de ubicacion
 * completa para poder encadenar los filtros sin volver al servidor.
 */
export interface Catalogos {
  proyectos: Array<{ id: number; codigo: string; nombre: string }>
  torres: Array<{ id: number; proyectoId: number; codigo: string; nombre: string }>
  pisos: Array<{ id: number; torreId: number; numero: number; nombre: string | null }>
  zonas: Array<{ id: number; pisoId: number; codigo: string; nombre: string }>
  actividades: Array<{ id: number; nombre: string; unidadMedida: string; activo: boolean }>
  cuadrillas: Array<{ id: number; proyectoId: number; nombre: string; activo: boolean }>
  trabajadores: Array<{
    id: number
    nombre: string
    apellido: string
    cargoId: number
    activo: boolean
  }>
  cargos: Array<{ id: number; nombre: string }>
  /**
   * Combinaciones que existen de verdad en los registros: [zonaId, actividadId,
   * cuadrillaId, trabajadorId]. Solo llega si se pide con ?combinaciones=1, y
   * es lo que permite que los filtros del panel se condicionen entre si.
   */
  combinaciones?: Array<[number, number, number, number | null]>
}

/**
 * Una tarea asignada, tal como la entrega /api/tareas: con su ubicacion
 * completa, a quien se le asigno y la obra que nacio de ella, si ya nacio.
 */
export interface Tarea {
  id: number
  codigo: string
  frenteId: number
  actividadId: number
  cuadrillaId: number | null
  trabajadorId: number | null
  largo: number
  alto: number
  m2Meta: number | null
  fechaInicioPlan: string | null
  fechaFinPlan: string | null
  estado: EstadoEjecucion
  observaciones: string | null
  frente?: FrenteUbicado
  actividad?: { id: number; nombre: string; unidadMedida: string }
  cuadrilla?: { id: number; nombre: string; proyectoId: number } | null
  trabajador?: {
    id: number
    nombre: string
    apellido: string
    cargo: { id: number; nombre: string }
  } | null
  usuarioAsigna?: { id: number; nombre: string; apellido: string }
  /** La obra que salio de la tarea. Null mientras no se haya registrado nada. */
  registro?: {
    id: number
    codigoRegistro: string
    fechaEjecucion: string
    m2Ejecutados: number
    avances: Array<{ m2Ejecutados: number }>
  } | null
}

/** Lo que devuelve /api/registros: la lista y su resumen ya calculado. */
export interface ListaRegistros {
  registros: Registro[]
  resumen: {
    registros: number
    obras: number
    m2Totales: number
    /** Producido en las jornadas filtradas. */
    m2Ejecutados: number
    /** Producido en las cadenas completas de esas obras. */
    m2Acumulados: number
    m2Pendientes: number
    m2Meta: number
    jornadasSinMeta: number
    horasEfectivas: number
    minutosReceso: number
    rendimiento: number | null
    cumplimiento: number | null
    avance: number | null
    obrasTerminadas: number
  }
  /** true cuando el filtro daba mas registros de los que caben en la pagina. */
  truncado: boolean
}