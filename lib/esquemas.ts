/**
 * Validacion de todo lo que entra por la API. Es la primera barrera antes de
 * tocar la base de datos, y las reglas de aqui son las mismas que aplican los
 * CHECK de PostgreSQL, para que el usuario reciba un mensaje claro en lugar de
 * un error crudo del motor.
 */
import { z } from 'zod'
import { ESTADOS_EJECUCION, ESTADOS_PROYECTO, ROLES } from '@/lib/dominio'

// --- Piezas reutilizables ---------------------------------------------------

const texto = (max: number, nombre: string) =>
  z
    .string()
    .trim()
    .min(1, `${nombre} es obligatorio`)
    .max(max, `${nombre} no puede pasar de ${max} caracteres`)

const textoOpcional = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null))

const patronFecha = /^\d{4}-\d{2}-\d{2}$/

const fecha = (nombre: string) =>
  z
    .string()
    .regex(patronFecha, `${nombre} debe tener el formato aaaa-mm-dd`)
    .transform((v) => new Date(`${v}T00:00:00.000Z`))

const fechaOpcional = z
  .union([z.literal(''), z.null(), z.string().regex(patronFecha)])
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null))


// El orden del union importa: la cadena vacia debe capturarse ANTES de
// intentar la coercion, porque Number('') es 0 y un campo en blanco acabaria
// guardandose como un objetivo de cero en lugar de quedar sin definir.
const decimalOpcional = (nombre: string) =>
  z
    .union([z.literal(''), z.null(), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (v >= 0 && v <= 99999999.99), {
      message: `${nombre} debe ser un numero positivo`,
    })

const hora = (nombre: string) =>
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${nombre} debe tener el formato hh:mm`)

// --- Jerarquia de obra ------------------------------------------------------

export const esquemaProyecto = z.object({
  codigo: texto(50, 'El codigo'),
  nombre: texto(150, 'El nombre'),
  descripcion: textoOpcional(2000),
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
  estado: z.enum(ESTADOS_PROYECTO),
}).refine(
  (d) => !d.fechaInicio || !d.fechaFin || d.fechaFin >= d.fechaInicio,
  { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['fechaFin'] },
)

export const esquemaTorre = z.object({
  proyectoId: z.coerce.number().int().positive('Selecciona un proyecto'),
  codigo: texto(20, 'El codigo'),
  nombre: texto(50, 'El nombre'),
  descripcion: textoOpcional(255),
  estado: z.enum(ESTADOS_EJECUCION),
})

export const esquemaPiso = z.object({
  torreId: z.coerce.number().int().positive('Selecciona una torre'),
  numero: z.coerce
    .number({ message: 'El numero de piso debe ser un entero' })
    .int('El numero de piso debe ser un entero')
    .min(-10, 'El numero de piso es demasiado bajo')
    .max(200, 'El numero de piso es demasiado alto'),
  nombre: textoOpcional(50),
  descripcion: textoOpcional(255),
})

export const esquemaZona = z.object({
  pisoId: z.coerce.number().int().positive('Selecciona un piso'),
  codigo: texto(50, 'El codigo'),
  nombre: texto(100, 'El nombre'),
  tipo: textoOpcional(50),
  descripcion: textoOpcional(255),
})

export const esquemaFrente = z.object({
  zonaId: z.coerce.number().int().positive('Selecciona una zona'),
  codigoDwg: texto(50, 'El codigo DWG'),
  descripcion: texto(150, 'La descripcion'),
  unidad: textoOpcional(20),
  estado: z.enum(ESTADOS_EJECUCION),
})

// --- Catalogos --------------------------------------------------------------

export const esquemaActividad = z.object({
  nombre: texto(100, 'El nombre'),
  unidadMedida: texto(20, 'La unidad de medida'),
  descripcion: textoOpcional(255),
  // La actividad no lleva precio: el precio por metro se acuerda con cada
  // trabajador y se captura en su ficha. Ver esquemaTrabajador.
  activo: z.boolean(),
})

export const esquemaCargo = z.object({
  nombre: texto(80, 'El nombre'),
  descripcion: textoOpcional(255),
})

// --- Personal ---------------------------------------------------------------

/** Un precio por metro para una actividad concreta de este trabajador. */
const esquemaTarifa = z.object({
  actividadId: z.coerce.number().int().positive('Selecciona una actividad'),
  valorM2: z.coerce
    .number({ message: 'El precio debe ser un numero' })
    .min(0, 'El precio no puede ser negativo')
    .max(99999999.99, 'El precio es demasiado grande'),
})

export const esquemaTrabajador = z.object({
  documento: textoOpcional(30),
  nombre: texto(100, 'El nombre'),
  apellido: texto(100, 'El apellido'),
  cargoId: z.coerce.number().int().positive('Selecciona un cargo'),
  activo: z.boolean(),
  /**
   * Lo que se le paga por metro en cada actividad. La lista puede venir vacia:
   * un trabajador puede darse de alta antes de acordar precios.
   */
  tarifas: z
    .array(esquemaTarifa)
    .optional()
    .default([])
    .refine((lista) => new Set(lista.map((t) => t.actividadId)).size === lista.length, {
      message: 'Hay una actividad repetida: cada actividad lleva un solo precio',
    }),
})

export const esquemaCuadrilla = z.object({
  proyectoId: z.coerce.number().int().positive('Selecciona un proyecto'),
  nombre: texto(100, 'El nombre'),
  descripcion: textoOpcional(255),
  activo: z.boolean(),
})

export const esquemaAsignacion = z.object({
  trabajadorId: z.coerce.number().int().positive('Selecciona un trabajador'),
  fechaInicio: fecha('La fecha de inicio'),
})

/** Cierre de una asignacion. La fecha la pone el cliente, en su zona horaria. */
export const esquemaCierreAsignacion = z.object({
  fechaFin: fecha('La fecha de cierre'),
})

// --- Metas ------------------------------------------------------------------

export const esquemaMeta = z
  .object({
    proyectoId: z.coerce.number().int().positive('Selecciona un proyecto'),
    actividadId: z.coerce.number().int().positive('Selecciona una actividad'),
    cargoId: z
      .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    rendimientoObjetivo: decimalOpcional('El rendimiento objetivo'),
    m2Objetivo: decimalOpcional('Los m2 objetivo'),
    vigenciaDesde: fecha('La vigencia desde'),
    vigenciaHasta: fechaOpcional,
  })
  .refine((d) => !d.vigenciaHasta || d.vigenciaHasta >= d.vigenciaDesde, {
    message: 'La vigencia hasta no puede ser anterior a la vigencia desde',
    path: ['vigenciaHasta'],
  })
  .refine((d) => d.rendimientoObjetivo !== null || d.m2Objetivo !== null, {
    message: 'Define al menos un objetivo: rendimiento o m2',
    path: ['rendimientoObjetivo'],
  })

// --- Usuarios ---------------------------------------------------------------

const passwordBase = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .max(72, 'La contrasena no puede pasar de 72 caracteres')

export const esquemaUsuarioNuevo = z.object({
  nombre: texto(100, 'El nombre'),
  apellido: texto(100, 'El apellido'),
  email: z.string().trim().toLowerCase().email('El correo no es valido').max(150),
  password: passwordBase,
  rol: z.enum(ROLES),
  activo: z.boolean(),
})

export const esquemaUsuarioEdicion = z.object({
  nombre: texto(100, 'El nombre'),
  apellido: texto(100, 'El apellido'),
  email: z.string().trim().toLowerCase().email('El correo no es valido').max(150),
  password: z
    .union([z.literal(''), z.null(), passwordBase])
    .optional()
    .transform((v) => (v ? v : null)),
  rol: z.enum(ROLES),
  activo: z.boolean(),
})

// --- Tareas asignadas -------------------------------------------------------

/**
 * El trabajo que se encarga antes de ejecutarlo. Lleva los mismos datos con los
 * que luego se registra la jornada, y el registro los hereda copiados.
 */
export const esquemaTarea = z
  .object({
    frenteId: z.coerce.number().int().positive('Selecciona un frente de trabajo'),
    actividadId: z.coerce.number().int().positive('Selecciona una actividad'),
    // Se puede programar el trabajo antes de saber quien lo hara.
    cuadrillaId: z
      .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    trabajadorId: z
      .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    largo: z.coerce
      .number({ message: 'El largo debe ser un numero' })
      .gt(0, 'El largo debe ser mayor que cero')
      .max(99999.99, 'El largo es demasiado grande'),
    alto: z.coerce
      .number({ message: 'El alto debe ser un numero' })
      .gt(0, 'El alto debe ser mayor que cero')
      .max(99999.99, 'El alto es demasiado grande'),
    m2Meta: decimalOpcional('Los m2 meta').transform((v) => (v && v > 0 ? v : null)),
    fechaInicioPlan: fechaOpcional,
    fechaFinPlan: fechaOpcional,
    estado: z.enum(ESTADOS_EJECUCION),
    observaciones: textoOpcional(2000),
  })
  .refine(
    (d) => !d.fechaInicioPlan || !d.fechaFinPlan || d.fechaFinPlan >= d.fechaInicioPlan,
    { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['fechaFinPlan'] },
  )
  .refine((d) => !d.trabajadorId || Boolean(d.cuadrillaId), {
    message: 'Para asignar un trabajador hay que elegir primero su cuadrilla',
    path: ['trabajadorId'],
  })

// --- Registros de obra ------------------------------------------------------

/** Campos que comparten el registro que abre la obra y los de avance. */
const camposJornada = {
  fechaEjecucion: fecha('La fecha de ejecucion'),
  cuadrillaId: z.coerce.number().int().positive('Selecciona una cuadrilla'),
  trabajadorId: z
    .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
  m2Ejecutados: z.coerce
    .number({ message: 'Los m2 ejecutados deben ser un numero' })
    .gt(0, 'Los m2 ejecutados deben ser mayores que cero')
    .max(99999999.99, 'Los m2 ejecutados son demasiado grandes'),
  horaInicio: hora('La hora de inicio'),
  horaFinal: hora('La hora final'),
  tiempoRecesoMin: z.coerce.number().int().min(0, 'El receso no puede ser negativo').max(600),
  // Una meta de cero no es una meta, es la ausencia de meta: se guarda nula
  // para que la jornada quede fuera del cumplimiento en vez de contar como
  // incumplida.
  m2Meta: decimalOpcional('Los m2 meta').transform((v) => (v && v > 0 ? v : null)),
  observaciones: textoOpcional(2000),
}

const mensajeHoraFinal = {
  message: 'La hora final debe ser posterior a la de inicio',
  path: ['horaFinal'],
}

const mensajeReceso = {
  message: 'El receso no puede consumir toda la jornada',
  path: ['tiempoRecesoMin'],
}

/** El receso debe dejar tiempo efectivo dentro de la jornada. */
const recesoCabe = (d: { horaInicio: string; horaFinal: string; tiempoRecesoMin: number }) => {
  const [hi, mi] = d.horaInicio.split(':').map(Number)
  const [hf, mf] = d.horaFinal.split(':').map(Number)
  return d.tiempoRecesoMin < hf * 60 + mf - (hi * 60 + mi)
}

/**
 * Registro que ABRE una obra: lleva la ubicacion, la actividad y las medidas
 * del elemento, que es contra lo que se mide el avance de toda la cadena.
 */
export const esquemaRegistroObra = z
  .object({
    ...camposJornada,
    /**
     * La tarea de la que nace esta obra, si nace de una. Es opcional a
     * proposito: se puede seguir abriendo obra directamente, y los registros
     * que ya existian no tienen tarea detras.
     */
    tareaId: z
      .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    frenteId: z.coerce.number().int().positive('Selecciona un frente de trabajo'),
    actividadId: z.coerce.number().int().positive('Selecciona una actividad'),
    largo: z.coerce
      .number({ message: 'El largo debe ser un numero' })
      .gt(0, 'El largo debe ser mayor que cero')
      .max(99999.99, 'El largo es demasiado grande'),
    alto: z.coerce
      .number({ message: 'El alto debe ser un numero' })
      .gt(0, 'El alto debe ser mayor que cero')
      .max(99999.99, 'El alto es demasiado grande'),
  })
  .refine((d) => d.horaFinal > d.horaInicio, mensajeHoraFinal)
  .refine(recesoCabe, mensajeReceso)
  .refine((d) => d.m2Ejecutados <= d.largo * d.alto + 0.005, {
    message: 'Lo ejecutado no puede superar el area del elemento',
    path: ['m2Ejecutados'],
  })

/**
 * Registro de AVANCE: continua una obra ya abierta. No repite la ubicacion ni
 * las medidas, solo apunta al registro anterior de esa misma obra.
 * Que lo acumulado no pase del area se valida en la API, porque depende de las
 * demas jornadas ya guardadas y no solo de esta.
 */
export const esquemaRegistroAvance = z
  .object({
    ...camposJornada,
    registroAnteriorId: z.coerce
      .number()
      .int()
      .positive('Selecciona el registro anterior de la obra'),
  })
  .refine((d) => d.horaFinal > d.horaInicio, mensajeHoraFinal)
  .refine(recesoCabe, mensajeReceso)
