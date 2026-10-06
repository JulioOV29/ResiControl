/** Validacion de lo que llega a la API (mismas reglas que los CHECK de la base). */
import { z } from 'zod'
import {
  areaDeVanos,
  fechaExiste,
  hoyEnColombia,
  normalizarUnidad,
  periodoCuadra,
  ESTADOS_EJECUCION,
  ESTADOS_PROYECTO,
  PERIODOS_LIQUIDACION,
  ROLES,
  TIPOS_CUENTA,
} from '@/lib/dominio'

// --- Piezas reutilizables ---

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

/** Fecha aaaa-mm-dd que existe en el calendario. */
const textoDeFecha = (nombre: string) =>
  z
    .string()
    .regex(patronFecha, `${nombre} debe tener el formato aaaa-mm-dd`)
    .refine(fechaExiste, `${nombre} no existe en el calendario`)

const fecha = (nombre: string) =>
  textoDeFecha(nombre).transform((v) => new Date(`${v}T00:00:00.000Z`))

/** Fecha que no puede ser posterior a hoy (hora de Colombia). */
const fechaHastaHoy = (nombre: string) =>
  textoDeFecha(nombre)
    .refine((v) => v <= hoyEnColombia(), `${nombre} no puede ser posterior a hoy`)
    .transform((v) => new Date(`${v}T00:00:00.000Z`))

const fechaOpcional = z
  .union([z.literal(''), z.null(), textoDeFecha('La fecha')])
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null))

/** Redondea a centesimas, como guarda la base. */
const centesimas = (v: number) => Math.round(v * 100) / 100

// El '' se revisa antes de convertir a numero: Number('') es 0 y no debe
// guardarse como cero.
const decimalOpcional = (nombre: string) =>
  z
    .union([z.literal(''), z.null(), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : centesimas(Number(v))))
    .refine((v) => v === null || (v >= 0 && v <= 99999999.99), {
      message: `${nombre} debe ser un numero positivo`,
    })

const hora = (nombre: string) =>
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${nombre} debe tener el formato hh:mm`)

// --- Jerarquia de obra ---

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

const medida = (nombre: string) =>
  z.coerce
    .number({ message: `${nombre} debe ser un numero` })
    .transform(centesimas)
    .refine((v) => v > 0, `${nombre} debe ser de al menos 0.01`)
    .refine((v) => v <= 99999.99, `${nombre} es demasiado grande`)

/** Hueco del elemento (ventana, puerta...): largo x ancho. */
const esquemaVano = z.object({
  descripcion: textoOpcional(100),
  largo: medida('El largo del vano'),
  ancho: medida('El ancho del vano'),
})

/** Elemento constructivo (muro, losa...). Sus medidas solo se guardan aqui. */
export const esquemaElemento = z
  .object({
    zonaId: z.coerce.number().int().positive('Selecciona una zona'),
    codigoDwg: texto(50, 'El codigo DWG'),
    descripcion: texto(150, 'La descripcion'),
    unidad: textoOpcional(20),
    largo: medida('El largo'),
    alto: medida('El alto'),
    estado: z.enum(ESTADOS_EJECUCION),
    /** Si no llega, al editar se conservan los vanos que ya tiene. */
    vanos: z.array(esquemaVano).max(50, 'Demasiados vanos').optional(),
  })
  .refine((d) => areaDeVanos(d.vanos ?? []) < d.largo * d.alto, {
    message: 'Los vanos no pueden ocupar toda el area del elemento',
    path: ['vanos'],
  })

// --- Catalogos ---

export const esquemaActividad = z.object({
  nombre: texto(100, 'El nombre'),
  // Se guarda normalizada (M2 o m² -> m2) para no partir los totales del panel.
  unidadMedida: texto(20, 'La unidad de medida').transform(normalizarUnidad),
  descripcion: textoOpcional(255),
  // El precio no va en la actividad, sino en cada trabajador.
  activo: z.boolean(),
})

export const esquemaCargo = z.object({
  nombre: texto(80, 'El nombre'),
  descripcion: textoOpcional(255),
})

// --- Personal ---

/** Precio de una actividad para el trabajador. */
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
  /** Precios por actividad. Puede ir vacia. */
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

/** Cierre de una asignacion; la fecha la manda el navegador (hora local). */
export const esquemaCierreAsignacion = z.object({
  fechaFin: fecha('La fecha de cierre'),
})

// --- Metas ---

export const esquemaMeta = z
  .object({
    proyectoId: z.coerce.number().int().positive('Selecciona un proyecto'),
    actividadId: z.coerce.number().int().positive('Selecciona una actividad'),
    cargoId: z
      .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    // Un objetivo en 0 se toma como "sin objetivo".
    rendimientoObjetivo: decimalOpcional('El rendimiento objetivo').transform((v) => (v ? v : null)),
    m2Objetivo: decimalOpcional('Los m2 objetivo').transform((v) => (v ? v : null)),
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

// --- Usuarios ---

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

// --- Tareas ---

/** Trabajo encargado antes de ejecutarse. El registro de obra copia sus datos. */
export const esquemaTarea = z
  .object({
    elementoId: z.coerce.number().int().positive('Selecciona un elemento constructivo'),
    actividadId: z.coerce.number().int().positive('Selecciona una actividad'),
    // Opcional: se puede programar sin saber quien lo hara.
    cuadrillaId: z
      .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    trabajadorId: z
      .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
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

// --- Registros de obra ---

/** Campos comunes a la apertura y a los avances. */
const camposJornada = {
  fechaEjecucion: fechaHastaHoy('La fecha de ejecucion'),
  cuadrillaId: z.coerce.number().int().positive('Selecciona una cuadrilla'),
  // Toda jornada es de un trabajador: asi se le puede liquidar.
  trabajadorId: z.coerce
    .number({ message: 'Selecciona el trabajador que hizo la jornada' })
    .int()
    .positive('Selecciona el trabajador que hizo la jornada'),
  m2Ejecutados: z.coerce
    .number({ message: 'Los m2 ejecutados deben ser un numero' })
    .transform(centesimas)
    .refine((v) => v > 0, 'Los m2 ejecutados deben ser mayores que cero')
    .refine((v) => v <= 99999999.99, 'Los m2 ejecutados son demasiado grandes'),
  horaInicio: hora('La hora de inicio'),
  horaFinal: hora('La hora final'),
  tiempoRecesoMin: z.coerce.number().int().min(0, 'El receso no puede ser negativo').max(600),
  // Meta 0 se guarda como null (jornada sin meta).
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

/** El receso debe dejar tiempo de trabajo. */
const recesoCabe = (d: { horaInicio: string; horaFinal: string; tiempoRecesoMin: number }) => {
  const [hi, mi] = d.horaInicio.split(':').map(Number)
  const [hf, mf] = d.horaFinal.split(':').map(Number)
  return d.tiempoRecesoMin < hf * 60 + mf - (hi * 60 + mi)
}

/** Registro que abre una obra. */
export const esquemaRegistroObra = z
  .object({
    ...camposJornada,
    /** Tarea de la que nace la obra (opcional). */
    tareaId: z
      .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
    elementoId: z.coerce.number().int().positive('Selecciona un elemento constructivo'),
    actividadId: z.coerce.number().int().positive('Selecciona una actividad'),
    /** Cantidad total: solo se usa en und, m3 y kg. En m2 y ml la calcula el servidor. */
    cantidadTotal: decimalOpcional('La cantidad total').transform((v) => (v && v > 0 ? v : null)),
    // Las medidas no llegan del navegador: el servidor las toma del elemento.
  })
  .refine((d) => d.horaFinal > d.horaInicio, mensajeHoraFinal)
  .refine(recesoCabe, mensajeReceso)

/**
 * Registro de avance: apunta al registro anterior de la misma obra.
 * Que no supere lo pendiente se valida en la API.
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

// --- Liquidaciones ---

/** Datos para liquidar. El total lo recalcula el servidor. */
export const esquemaLiquidacion = z
  .object({
    trabajadorId: z.coerce.number().int().positive('Selecciona un trabajador'),
    tipoPeriodo: z.enum(PERIODOS_LIQUIDACION),
    desde: textoDeFecha('La fecha desde'),
    hasta: textoDeFecha('La fecha hasta'),
    banco: textoOpcional(80),
    tipoCuenta: z
      .union([z.enum(TIPOS_CUENTA), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    numeroCuenta: z
      .string()
      .trim()
      .min(4, 'El numero de cuenta es obligatorio')
      .max(40, 'El numero de cuenta no puede pasar de 40 caracteres')
      .regex(/^[0-9][0-9 -]*[0-9]$/, 'El numero de cuenta solo lleva digitos, espacios o guiones'),
    observaciones: textoOpcional(2000),
    /** Total que se mostro en el aviso. Si al guardar da otro, no se guarda. */
    totalEsperado: z.coerce.number().nonnegative().optional(),
  })
  .refine((d) => d.hasta >= d.desde, {
    message: 'La fecha hasta no puede ser anterior a la fecha desde',
    path: ['hasta'],
  })
  .refine((d) => periodoCuadra(d.tipoPeriodo, d.desde, d.hasta), {
    message: 'Las fechas no corresponden a un mes o una quincena completos',
    path: ['desde'],
  })
  .transform((d) => ({
    ...d,
    desde: new Date(`${d.desde}T00:00:00.000Z`),
    hasta: new Date(`${d.hasta}T00:00:00.000Z`),
  }))
