/**
 * Piezas de consulta compartidas entre rutas. Viven aqui y no en un route.ts
 * porque Next.js solo admite exportar los manejadores HTTP desde esos archivos.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ErrorApi } from '@/lib/api'

/** La ubicacion completa de un frente, desde la zona hasta el proyecto. */
const ubicacionFrente = {
  select: {
    id: true,
    codigoDwg: true,
    descripcion: true,
    unidad: true,
    zona: {
      select: {
        id: true,
        codigo: true,
        nombre: true,
        piso: {
          select: {
            id: true,
            numero: true,
            nombre: true,
            torre: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                proyecto: { select: { id: true, codigo: true, nombre: true } },
              },
            },
          },
        },
      },
    },
  },
} as const

/** Lo minimo para mostrar un registro como referencia clicable. */
const resumenRegistro = {
  select: {
    id: true,
    codigoRegistro: true,
    numeroAvance: true,
    fechaEjecucion: true,
    m2Ejecutados: true,
    largo: true,
    alto: true,
  },
} as const

/** Relaciones que acompañan a cada registro en listados e informes. */
export const relacionesRegistro = {
  frente: ubicacionFrente,
  actividad: { select: { id: true, nombre: true, unidadMedida: true } },
  cuadrilla: { select: { id: true, nombre: true } },
  trabajador: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      cargo: { select: { id: true, nombre: true } },
    },
  },
  usuarioRegistra: { select: { id: true, nombre: true, apellido: true } },
  /// El dia anterior de la obra: es la referencia que se abre desde la lista.
  registroAnterior: resumenRegistro,
  /// El registro que abrio la obra, de donde salen las medidas del elemento.
  registroOrigen: resumenRegistro,
  /// El dia siguiente, si ya existe.
  continuacion: { select: { id: true, codigoRegistro: true, fechaEjecucion: true } },
  /// La tarea de la que nacio la obra, para poder volver al encargo.
  tarea: { select: { id: true, codigo: true } },
} as const

/**
 * Lo minimo para calcular indicadores: los numeradores, los denominadores y a
 * que obra pertenece cada jornada.
 *
 * Existe porque sumar m2 y horas no necesita saber quien registro la jornada ni
 * como se llama la actividad. Traer relacionesRegistro entero para acabar
 * sumando dos columnas son siete joins y varios kilobytes por fila tirados.
 */
export const camposIndicadores = {
  id: true,
  registroOrigenId: true,
  largo: true,
  alto: true,
  m2Ejecutados: true,
  m2Meta: true,
  horaInicio: true,
  horaFinal: true,
  tiempoRecesoMin: true,
  registroOrigen: { select: { largo: true, alto: true } },
} as const

/**
 * Lo anterior mas lo justo para agrupar: por dia, por actividad, por ubicacion
 * y por cuadrilla.
 */
export const camposPanel = {
  ...camposIndicadores,
  fechaEjecucion: true,
  cuadrillaId: true,
  cuadrilla: { select: { nombre: true } },
  actividadId: true,
  actividad: { select: { nombre: true, unidadMedida: true } },
  frente: {
    select: {
      id: true,
      codigoDwg: true,
      descripcion: true,
      zona: {
        select: {
          id: true,
          nombre: true,
          piso: {
            select: {
              id: true,
              numero: true,
              nombre: true,
              torre: { select: { id: true, nombre: true } },
            },
          },
        },
      },
    },
  },
} as const

/** Traduce los parametros de la url a un filtro de registros. */
export function filtroRegistros(
  parametros: URLSearchParams,
): Prisma.RegistroEjecucionWhereInput {
  const where: Prisma.RegistroEjecucionWhereInput = {}

  const desde = parametros.get('desde')
  const hasta = parametros.get('hasta')
  if (desde || hasta) {
    where.fechaEjecucion = {
      ...(desde ? { gte: new Date(`${desde}T00:00:00.000Z`) } : {}),
      ...(hasta ? { lte: new Date(`${hasta}T00:00:00.000Z`) } : {}),
    }
  }

  const numero = (clave: string) => {
    const v = Number(parametros.get(clave))
    return Number.isInteger(v) && v > 0 ? v : null
  }

  const actividadId = numero('actividadId')
  if (actividadId) where.actividadId = actividadId

  const cuadrillaId = numero('cuadrillaId')
  if (cuadrillaId) where.cuadrillaId = cuadrillaId

  const trabajadorId = numero('trabajadorId')
  if (trabajadorId) where.trabajadorId = trabajadorId

  // Por cargo se filtra a traves del trabajador, que es quien lo lleva.
  const cargoId = numero('cargoId')
  if (cargoId) where.trabajador = { cargoId }

  // La ubicacion filtra por el nivel mas especifico informado: filtrar por zona
  // ya implica el piso, la torre y el proyecto.
  const frenteId = numero('frenteId')
  const zonaId = numero('zonaId')
  const pisoId = numero('pisoId')
  const torreId = numero('torreId')
  const proyectoId = numero('proyectoId')

  if (frenteId) where.frenteId = frenteId
  else if (zonaId) where.frente = { zonaId }
  else if (pisoId) where.frente = { zona: { pisoId } }
  else if (torreId) where.frente = { zona: { piso: { torreId } } }
  else if (proyectoId) where.frente = { zona: { piso: { torre: { proyectoId } } } }

  // Solo los registros que abren obra, para listar obras en lugar de jornadas.
  if (parametros.get('soloAperturas') === '1') where.registroOrigenId = null

  return where
}

/**
 * La tarifa vigente de un trabajador para una actividad, para congelarla en la
 * jornada que se esta guardando.
 *
 * El precio se acuerda con la persona, asi que depende de la pareja
 * (trabajador, actividad) y no de la actividad sola. Devuelve null cuando la
 * jornada no tiene trabajador, o cuando ese trabajador no tiene precio
 * acordado para esa actividad: la jornada se guarda igual, sin importe.
 *
 * Se congela por la misma razon que la meta: lo que vale el trabajo se decide
 * el dia que se hace. Si se leyera al liquidar, subirle el precio a alguien en
 * marzo cambiaria de golpe lo que se le pago en enero, y eso no es un
 * indicador desactualizado sino una cuenta equivocada.
 */
export async function tarifaDeTrabajador(
  trabajadorId: number | null | undefined,
  actividadId: number,
) {
  if (!trabajadorId) return null
  const tarifa = await prisma.trabajadorActividad.findUnique({
    where: { trabajadorId_actividadId: { trabajadorId, actividadId } },
    select: { valorM2: true },
  })
  return tarifa?.valorM2 ?? null
}

/** "07:30" -> Date apto para un campo TIME de PostgreSQL. */
export function aHora(texto: string) {
  const [h, m] = texto.split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, h, m, 0))
}

/** Suma los m2 ejecutados de un conjunto de registros. */
export function sumarEjecutado(registros: Array<{ m2Ejecutados: unknown }>): number {
  let total = 0
  for (const r of registros) total += Number(String(r.m2Ejecutados))
  return total
}

/**
 * El ultimo registro de una cadena, que es al que hay que encadenar el
 * siguiente avance: el unico que todavia no tiene continuacion.
 */
export function ultimoDeCadena(
  raiz: { id: number; codigoRegistro: string; continuacion: unknown },
  avances: Array<{ id: number; codigoRegistro: string; continuacion: unknown }>,
) {
  const abierto = avances.find((a) => !a.continuacion)
  if (abierto) return { id: abierto.id, codigoRegistro: abierto.codigoRegistro }
  return { id: raiz.id, codigoRegistro: raiz.codigoRegistro }
}

/**
 * Estado de una obra completa a partir de cualquiera de sus registros.
 * Devuelve el area del elemento, lo acumulado en toda la cadena y lo que falta.
 *
 * `excluirRegistroId` sirve al editar: la jornada que se esta modificando no
 * debe contar como consumida, porque su valor se va a reemplazar.
 */
export async function estadoDeObra(raizId: number, excluirRegistroId?: number) {
  const raiz = await prisma.registroEjecucion.findUnique({
    where: { id: raizId },
    select: {
      id: true,
      codigoRegistro: true,
      largo: true,
      alto: true,
      m2Ejecutados: true,
      avances: { select: { id: true, m2Ejecutados: true } },
    },
  })

  if (!raiz) return null

  const total = Number(String(raiz.largo ?? 0)) * Number(String(raiz.alto ?? 0))
  const dias = [
    { id: raiz.id, m2Ejecutados: raiz.m2Ejecutados },
    ...raiz.avances,
  ].filter((d) => d.id !== excluirRegistroId)

  const ejecutado = sumarEjecutado(dias)

  return {
    raizId: raiz.id,
    codigoRaiz: raiz.codigoRegistro,
    total,
    ejecutado,
    pendiente: Math.max(0, total - ejecutado),
    completada: total > 0 && ejecutado >= total - 0.005,
  }
}

/** Una fecha guardada (medianoche UTC) como texto aaaa-mm-dd. */
const textoFecha = (valor: Date) => valor.toISOString().slice(0, 10)

/**
 * Comprueba que la jornada sea coherente con el resto del modelo:
 *
 *   - la cuadrilla y el frente tienen que ser del mismo proyecto, porque una
 *     cuadrilla se contrata para una obra concreta;
 *   - el trabajador tiene que haber estado asignado a esa cuadrilla el dia que
 *     se registra, que es justo para lo que existe el historial de
 *     asignaciones.
 *
 * Sin esto se podia guardar produccion de la Torre B a nombre de una cuadrilla
 * de otro proyecto, y los cortes por cuadrilla del panel quedaban sin sentido.
 */
export async function validarCoherencia(datos: {
  frenteId: number
  /** Nulo solo en una tarea que todavia no tiene cuadrilla asignada. */
  cuadrillaId: number | null
  trabajadorId: number | null
  fechaEjecucion: Date
}) {
  if (datos.cuadrillaId === null) {
    // Sin cuadrilla no hay nada que cruzar, pero el frente tiene que existir.
    const existe = await prisma.frenteTrabajo.findUnique({
      where: { id: datos.frenteId },
      select: { id: true },
    })
    if (!existe) throw new ErrorApi(404, 'El frente de trabajo no existe')
    return
  }

  const [frente, cuadrilla] = await Promise.all([
    prisma.frenteTrabajo.findUnique({
      where: { id: datos.frenteId },
      select: {
        codigoDwg: true,
        zona: {
          select: {
            piso: { select: { torre: { select: { proyectoId: true, nombre: true } } } },
          },
        },
      },
    }),
    prisma.cuadrilla.findUnique({
      where: { id: datos.cuadrillaId },
      select: { proyectoId: true, nombre: true },
    }),
  ])

  if (!frente) throw new ErrorApi(404, 'El frente de trabajo no existe')
  if (!cuadrilla) throw new ErrorApi(404, 'La cuadrilla no existe')

  if (frente.zona.piso.torre.proyectoId !== cuadrilla.proyectoId) {
    throw new ErrorApi(
      409,
      `La cuadrilla ${cuadrilla.nombre} no pertenece al proyecto de ${frente.zona.piso.torre.nombre}`,
    )
  }

  if (datos.trabajadorId === null) return

  const asignacion = await prisma.cuadrillaTrabajador.findFirst({
    where: {
      trabajadorId: datos.trabajadorId,
      cuadrillaId: datos.cuadrillaId,
      fechaInicio: { lte: datos.fechaEjecucion },
      OR: [{ fechaFin: null }, { fechaFin: { gte: datos.fechaEjecucion } }],
    },
    select: { id: true },
  })

  if (!asignacion) {
    const trabajador = await prisma.trabajador.findUnique({
      where: { id: datos.trabajadorId },
      select: { nombre: true, apellido: true },
    })
    const quien = trabajador ? `${trabajador.nombre} ${trabajador.apellido}` : 'El trabajador'
    throw new ErrorApi(
      409,
      `${quien} no estaba en la cuadrilla ${cuadrilla.nombre} el ${textoFecha(datos.fechaEjecucion)}`,
    )
  }
}

/**
 * Comprueba que mover la fecha de un registro no desordene su cadena: la
 * apertura no puede quedar despues de su primer avance, y un avance no puede
 * quedar antes del registro que continua ni despues del que lo continua.
 */
export async function validarFechaEnCadena(
  registro: { id: number; registroOrigenId: number | null; registroAnteriorId: number | null },
  fecha: Date,
) {
  if (registro.registroOrigenId === null) {
    const primerAvance = await prisma.registroEjecucion.findFirst({
      where: { registroOrigenId: registro.id },
      orderBy: { fechaEjecucion: 'asc' },
      select: { codigoRegistro: true, fechaEjecucion: true },
    })
    if (primerAvance && fecha > primerAvance.fechaEjecucion) {
      throw new ErrorApi(
        409,
        `La obra no puede empezar despues de su avance ${primerAvance.codigoRegistro}, del ${textoFecha(primerAvance.fechaEjecucion)}`,
      )
    }
    return
  }

  const [anterior, siguiente] = await Promise.all([
    registro.registroAnteriorId
      ? prisma.registroEjecucion.findUnique({
          where: { id: registro.registroAnteriorId },
          select: { codigoRegistro: true, fechaEjecucion: true },
        })
      : Promise.resolve(null),
    prisma.registroEjecucion.findUnique({
      where: { registroAnteriorId: registro.id },
      select: { codigoRegistro: true, fechaEjecucion: true },
    }),
  ])

  if (anterior && fecha < anterior.fechaEjecucion) {
    throw new ErrorApi(
      409,
      `El avance no puede ser anterior a ${anterior.codigoRegistro}, del ${textoFecha(anterior.fechaEjecucion)}`,
    )
  }
  if (siguiente && fecha > siguiente.fechaEjecucion) {
    throw new ErrorApi(
      409,
      `El avance no puede ser posterior a ${siguiente.codigoRegistro}, del ${textoFecha(siguiente.fechaEjecucion)}`,
    )
  }
}

/**
 * Codigo de una tarea nueva: TA01, TA02... Sobre el maximo existente y no
 * contando filas, para que borrar una tarea no genere codigos repetidos.
 */
export async function siguienteCodigoDeTarea() {
  const tareas = await prisma.tarea.findMany({ select: { codigo: true } })
  const numeros = tareas
    .map((t) => Number(t.codigo.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n))
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1
  return `TA${String(siguiente).padStart(2, '0')}`
}

/** Lo que hace falta de una tarea para pintarla en pantalla. */
export const relacionesTarea = {
  frente: ubicacionFrente,
  actividad: { select: { id: true, nombre: true, unidadMedida: true } },
  cuadrilla: { select: { id: true, nombre: true, proyectoId: true } },
  trabajador: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      cargo: { select: { id: true, nombre: true } },
    },
  },
  usuarioAsigna: { select: { id: true, nombre: true, apellido: true } },
  /// La obra que nacio de la tarea, con sus avances, para saber como va.
  registro: {
    select: {
      id: true,
      codigoRegistro: true,
      fechaEjecucion: true,
      m2Ejecutados: true,
      avances: { select: { m2Ejecutados: true } },
    },
  },
} as const

/**
 * Pone al dia el estado de una tarea segun lo que se haya ejecutado de su obra.
 *
 * El estado se guarda en vez de calcularse porque el residente tambien lo
 * mueve a mano (suspender una tarea, por ejemplo), pero lo obvio no deberia
 * tener que teclearlo: en cuanto hay una jornada, la tarea esta EN_PROCESO, y
 * cuando la obra llega al 100% queda TERMINADO.
 *
 * SUSPENDIDO no se toca: es una decision, no un estado derivado del avance.
 */
export async function sincronizarEstadoTarea(tareaId: number | null | undefined) {
  if (!tareaId) return

  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    select: {
      estado: true,
      largo: true,
      alto: true,
      registro: {
        select: { m2Ejecutados: true, avances: { select: { m2Ejecutados: true } } },
      },
    },
  })
  if (!tarea || tarea.estado === 'SUSPENDIDO') return

  const total = Number(String(tarea.largo)) * Number(String(tarea.alto))
  const ejecutado = tarea.registro
    ? Number(String(tarea.registro.m2Ejecutados)) +
      sumarEjecutado(tarea.registro.avances)
    : 0

  const estado =
    ejecutado <= 0
      ? 'PENDIENTE'
      : total > 0 && ejecutado >= total - 0.005
        ? 'TERMINADO'
        : 'EN_PROCESO'

  if (estado !== tarea.estado) {
    await prisma.tarea.update({ where: { id: tareaId }, data: { estado } })
  }
}

/**
 * La tarea de la obra a la que pertenece un registro. Solo la lleva el registro
 * que abre la obra, asi que un avance la busca en su origen.
 */
export async function tareaDeLaObra(raizId: number) {
  const raiz = await prisma.registroEjecucion.findUnique({
    where: { id: raizId },
    select: { tareaId: true },
  })
  return raiz?.tareaId ?? null
}

/**
 * Comprueba que una obra pueda nacer de esa tarea.
 *
 * Dos reglas: una tarea da lugar a UNA obra, y el registro tiene que ser del
 * mismo frente y de la misma actividad que la tarea. Lo demas (cuadrilla,
 * trabajador, medidas, meta) se hereda al abrir el formulario pero puede
 * diferir, porque lo que se encarga y lo que pasa en obra no siempre coinciden.
 */
export async function validarTareaParaObra(
  tareaId: number,
  datos: { frenteId: number; actividadId: number },
  registroActualId?: number,
) {
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    select: {
      codigo: true,
      frenteId: true,
      actividadId: true,
      registro: { select: { id: true, codigoRegistro: true } },
    },
  })
  if (!tarea) throw new ErrorApi(404, 'La tarea asignada no existe')

  if (tarea.registro && tarea.registro.id !== registroActualId) {
    throw new ErrorApi(
      409,
      `La tarea ${tarea.codigo} ya dio lugar a la obra ${tarea.registro.codigoRegistro}`,
    )
  }

  if (tarea.frenteId !== datos.frenteId || tarea.actividadId !== datos.actividadId) {
    throw new ErrorApi(
      409,
      `El registro tiene que ser del mismo frente y la misma actividad de la tarea ${tarea.codigo}`,
    )
  }
}
