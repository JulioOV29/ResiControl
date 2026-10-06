/** Datos tal como llegan de la API: Decimal como number y fechas como texto ISO. */

import type { EstadoEjecucion, EstadoProyecto, Rol } from '@/lib/dominio'

export type { EstadoEjecucion, EstadoProyecto, Rol }

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
  _count?: { elementos: number }
}

export interface Elemento {
  id: number
  zonaId: number
  codigoDwg: string
  descripcion: string
  unidad: string | null
  /** Medidas del elemento (solo se guardan aqui). */
  largo: number
  alto: number
  /** Suma del area de los vanos. */
  areaVanos: number
  vanos?: Vano[]
  estado: EstadoEjecucion
  zona?: {
    codigo: string
    nombre: string
    piso: { numero: number; torre: { codigo: string; nombre: string } }
  }
  _count?: { registros: number }
}

/** Elemento con su ubicacion completa. */
/** Hueco de un elemento (ventana, puerta...). */
export interface Vano {
  id: number
  descripcion: string | null
  largo: number
  ancho: number
}

export interface ElementoUbicado {
  id: number
  codigoDwg: string
  descripcion: string
  unidad: string | null
  largo: number
  alto: number
  areaVanos: number
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

/** Precio por unidad de una actividad para un trabajador. */
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
  /** Precios del trabajador, uno por actividad. */
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
    /** Precios del trabajador (para saber si puede hacer la actividad). */
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
  cantidadTotal?: number | null
}

export interface Registro {
  id: number
  codigoRegistro: string
  fechaEjecucion: string
  elementoId: number
  actividadId: number
  cuadrillaId: number
  trabajadorId: number | null
  /** Registro anterior. Null en la apertura. */
  registroAnteriorId: number | null
  /** Registro que abrio la obra. Null en la apertura. */
  registroOrigenId: number | null
  /** Tarea de origen. Solo en la apertura. */
  tareaId: number | null
  tarea?: { id: number; codigo: string } | null
  /** Numero de avance (1, 2, 3...). Null en la apertura. */
  numeroAvance: number | null
  /** Medidas del elemento. Solo en la apertura. */
  largo: number | null
  alto: number | null
  /** Cantidad total de la obra. Solo en la apertura. */
  cantidadTotal: number | null
  m2Ejecutados: number
  horaInicio: string
  horaFinal: string
  tiempoRecesoMin: number
  m2Meta: number | null
  /** Precio por unidad copiado al guardar. */
  valorM2: number | null
  observaciones: string | null
  elemento?: ElementoUbicado
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
  /** Liquidacion en que se pago. */
  liquidacionId?: number | null
  liquidacion?: { id: number; codigo: string } | null
}

/** Obra: registro de apertura con sus avances. */
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

/** Catalogos de /api/catalogos para llenar filtros y formularios. */
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
   * Combinaciones reales [zonaId, actividadId, cuadrillaId, trabajadorId].
   * Solo con ?combinaciones=1.
   */
  combinaciones?: Array<[number, number, number, number | null]>
}

/** Tarea con su ubicacion, asignados y la obra que nacio de ella. */
export interface Tarea {
  id: number
  codigo: string
  elementoId: number
  actividadId: number
  cuadrillaId: number | null
  trabajadorId: number | null
  m2Meta: number | null
  fechaInicioPlan: string | null
  fechaFinPlan: string | null
  estado: EstadoEjecucion
  observaciones: string | null
  elemento?: ElementoUbicado
  actividad?: { id: number; nombre: string; unidadMedida: string }
  cuadrilla?: { id: number; nombre: string; proyectoId: number } | null
  trabajador?: {
    id: number
    nombre: string
    apellido: string
    cargo: { id: number; nombre: string }
  } | null
  usuarioAsigna?: { id: number; nombre: string; apellido: string }
  /** Obra que nacio de la tarea. Null si aun no hay. */
  registro?: {
    id: number
    codigoRegistro: string
    fechaEjecucion: string
    m2Ejecutados: number
    cantidadTotal: number | null
    avances: Array<{ m2Ejecutados: number }>
  } | null
}

/** Respuesta de /api/registros. */
export interface ListaRegistros {
  registros: Registro[]
  /** Un resumen por unidad de medida; nunca se mezclan unidades. */
  resumenes: Array<{
    unidad: string
    registros: number
    obras: number
    m2Totales: number
    /** Ejecutado en el periodo. */
    m2Ejecutados: number
    /** Ejecutado en toda la cadena de esas obras. */
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
  }>
  /** true si hay mas registros de los que se devolvieron. */
  truncado: boolean
}

// --- Liquidaciones ---

export interface LineaLiquidacion {
  actividadId: number
  actividadNombre: string
  unidad: string
  valorUnitario: number
  cantidad: number
  jornadas: number
  subtotal: number
}

/** Jornada dentro de una liquidacion. */
export interface JornadaLiquidacion {
  id: number
  codigoRegistro: string
  fechaEjecucion: string
  actividad: string
  unidad: string
  cantidad: number
  valorUnitario: number | null
  subtotal: number | null
  elemento: string
  liquidacion?: string | null
}

export interface TrabajadorLiquidado {
  id: number
  nombre: string
  apellido: string
  documento: string | null
  cargo: { nombre: string }
}

export interface Liquidacion {
  id: number
  codigo: string
  trabajadorId: number
  tipoPeriodo: 'MES' | 'QUINCENA' | 'RANGO'
  desde: string
  hasta: string
  total: number
  banco: string | null
  tipoCuenta: string | null
  numeroCuenta: string
  observaciones: string | null
  createdAt: string
  trabajador: TrabajadorLiquidado
  usuarioLiquida: { id: number; nombre: string; apellido: string; email: string }
  lineas?: Array<LineaLiquidacion & { id: number }>
  registros?: JornadaLiquidacion[]
  _count?: { registros: number }
}

/** Respuesta de /api/liquidaciones/previa. */
export interface PreviaLiquidacion {
  trabajador: TrabajadorLiquidado
  ultimaCuenta: { banco: string | null; tipoCuenta: string | null; numeroCuenta: string } | null
  desde: string
  hasta: string
  lineas: LineaLiquidacion[]
  total: number
  jornadas: JornadaLiquidacion[]
  sinPrecio: JornadaLiquidacion[]
  yaPagadas: JornadaLiquidacion[]
  /** Jornadas sin pagar con fecha anterior al lapso. */
  pendientesAnteriores: { jornadas: number; desde: string | null }
}
