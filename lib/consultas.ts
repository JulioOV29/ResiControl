/** Consultas y validaciones que comparten varias rutas de la API. */
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ErrorApi } from '@/lib/api'
import { cantidadDeObra } from '@/lib/calculos'
import { cantidadDelElemento, fechaExiste, modoCantidad, normalizarUnidad } from '@/lib/dominio'

/** Cliente normal o el de una transaccion. */
type Cliente = PrismaClient | Prisma.TransactionClient

/**
 * Bloquea filas de registros hasta que termine la transaccion.
 * Asi una edicion, un borrado y una liquidacion no se cruzan.
 */
export async function bloquearRegistros(tx: Prisma.TransactionClient, ids: number[]) {
  const unicos = [...new Set(ids)].sort((a, b) => a - b)
  for (const id of unicos) {
    await tx.$queryRaw`SELECT id_ejecucion FROM registros_ejecucion WHERE id_ejecucion = ${id} FOR UPDATE`
  }
}

/** Una jornada pagada no se modifica ni se borra. */
export async function exigirNoPagado(cliente: Cliente, id: number, accion: string) {
  const registro = await cliente.registroEjecucion.findUnique({
    where: { id },
    select: { codigoRegistro: true, liquidacion: { select: { codigo: true } } },
  })
  if (!registro) throw new ErrorApi(404, 'El registro no existe')
  if (registro.liquidacion) {
    throw new ErrorApi(
      409,
      `${registro.codigoRegistro} ya se pago en la liquidacion ${registro.liquidacion.codigo}: no se puede ${accion}. Si hay un error, un administrador tiene que anular esa liquidacion primero.`,
    )
  }
}

/** Ubicacion completa de un elemento: zona, piso, torre y proyecto. */
const ubicacionElemento = {
  select: {
    id: true,
    codigoDwg: true,
    descripcion: true,
    unidad: true,
    largo: true,
    alto: true,
    areaVanos: true,
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

/** Datos minimos de un registro para enlazarlo. */
const resumenRegistro = {
  select: {
    id: true,
    codigoRegistro: true,
    numeroAvance: true,
    fechaEjecucion: true,
    m2Ejecutados: true,
    largo: true,
    alto: true,
    cantidadTotal: true,
  },
} as const

/** Relaciones que acompanan a cada registro en los listados. */
export const relacionesRegistro = {
  elemento: ubicacionElemento,
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
  /// Registro anterior de la obra.
  registroAnterior: resumenRegistro,
  /// Registro que abrio la obra.
  registroOrigen: resumenRegistro,
  /// Registro siguiente, si existe.
  continuacion: { select: { id: true, codigoRegistro: true, fechaEjecucion: true } },
  /// Tarea de la que nacio la obra.
  tarea: { select: { id: true, codigo: true } },
  /// Liquidacion en que se pago.
  liquidacion: { select: { id: true, codigo: true } },
} as const

/** Solo los campos que usan los calculos de indicadores (evita joins de mas). */
export const camposIndicadores = {
  id: true,
  registroOrigenId: true,
  largo: true,
  alto: true,
  cantidadTotal: true,
  m2Ejecutados: true,
  m2Meta: true,
  horaInicio: true,
  horaFinal: true,
  tiempoRecesoMin: true,
  registroOrigen: { select: { largo: true, alto: true, cantidadTotal: true } },
} as const

/** Campos de indicadores mas los necesarios para agrupar en el panel. */
export const camposPanel = {
  ...camposIndicadores,
  fechaEjecucion: true,
  cuadrillaId: true,
  cuadrilla: { select: { nombre: true } },
  actividadId: true,
  actividad: { select: { nombre: true, unidadMedida: true } },
  elemento: {
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

/** Convierte los parametros de la url en un filtro de registros. */
export function filtroRegistros(
  parametros: URLSearchParams,
): Prisma.RegistroEjecucionWhereInput {
  const where: Prisma.RegistroEjecucionWhereInput = {}

  // Fechas mal escritas se ignoran (no rompen la consulta).
  const fechaValida = (clave: string) => {
    const v = parametros.get(clave)
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && fechaExiste(v) ? v : null
  }
  const desde = fechaValida('desde')
  const hasta = fechaValida('hasta')
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

  // Unidad de la actividad (m2, ml, und...). El panel nunca mezcla unidades.
  const unidad = parametros.get('unidad')
  if (unidad) where.actividad = { unidadMedida: unidad }

  const cuadrillaId = numero('cuadrillaId')
  if (cuadrillaId) where.cuadrillaId = cuadrillaId

  const trabajadorId = numero('trabajadorId')
  if (trabajadorId) where.trabajadorId = trabajadorId

  // El cargo se filtra por el trabajador.
  const cargoId = numero('cargoId')
  if (cargoId) where.trabajador = { cargoId }

  // Se usa el nivel de ubicacion mas especifico que llegue.
  const elementoId = numero('elementoId')
  const zonaId = numero('zonaId')
  const pisoId = numero('pisoId')
  const torreId = numero('torreId')
  const proyectoId = numero('proyectoId')

  if (elementoId) where.elementoId = elementoId
  else if (zonaId) where.elemento = { zonaId }
  else if (pisoId) where.elemento = { zona: { pisoId } }
  else if (torreId) where.elemento = { zona: { piso: { torreId } } }
  else if (proyectoId) where.elemento = { zona: { piso: { torre: { proyectoId } } } }

  // Solo registros que abren obra.
  if (parametros.get('soloAperturas') === '1') where.registroOrigenId = null

  return where
}

/**
 * Precio vigente del trabajador para la actividad, para copiarlo en la jornada.
 * null si no hay trabajador o no tiene precio para esa actividad.
 * Se copia para que un cambio de precio futuro no altere lo ya registrado.
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

/** Suma lo ejecutado de varios registros. */
function sumarEjecutado(registros: Array<{ m2Ejecutados: unknown }>): number {
  let total = 0
  for (const r of registros) total += Number(String(r.m2Ejecutados))
  return total
}

/**
 * Ultimo registro de la cadena (el que no tiene continuacion).
 * A el se encadena el siguiente avance.
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
 * Cantidad total, ejecutado y pendiente de una obra.
 * `excluirRegistroId`: al editar, no contar el registro que se esta cambiando.
 */
export async function estadoDeObra(
  raizId: number,
  excluirRegistroId?: number,
  cliente: Cliente = prisma,
) {
  const raiz = await cliente.registroEjecucion.findUnique({
    where: { id: raizId },
    select: {
      id: true,
      codigoRegistro: true,
      largo: true,
      alto: true,
      cantidadTotal: true,
      m2Ejecutados: true,
      actividad: { select: { unidadMedida: true } },
      avances: { select: { id: true, m2Ejecutados: true } },
    },
  })

  if (!raiz) return null

  const total = cantidadDeObra(raiz)
  const dias = [
    { id: raiz.id, m2Ejecutados: raiz.m2Ejecutados },
    ...raiz.avances,
  ].filter((d) => d.id !== excluirRegistroId)

  const ejecutado = sumarEjecutado(dias)

  return {
    raizId: raiz.id,
    codigoRaiz: raiz.codigoRegistro,
    unidad: raiz.actividad.unidadMedida,
    total,
    ejecutado,
    pendiente: Math.max(0, total - ejecutado),
    completada: total > 0 && ejecutado >= total - 0.005,
  }
}

/** Fecha guardada (medianoche UTC) -> aaaa-mm-dd. */
const textoFecha = (valor: Date) => valor.toISOString().slice(0, 10)

/**
 * Valida que la jornada sea coherente:
 * - la cuadrilla es del mismo proyecto que el elemento
 * - el trabajador estaba en esa cuadrilla en esa fecha
 */
export async function validarCoherencia(datos: {
  elementoId: number
  /** Null solo en tareas sin cuadrilla asignada. */
  cuadrillaId: number | null
  trabajadorId: number | null
  fechaEjecucion: Date
}) {
  if (datos.cuadrillaId === null) {
    // Sin cuadrilla solo se verifica que el elemento exista.
    const existe = await prisma.elementoConstructivo.findUnique({
      where: { id: datos.elementoId },
      select: { id: true },
    })
    if (!existe) throw new ErrorApi(404, 'El elemento constructivo no existe')
    return
  }

  const [elemento, cuadrilla] = await Promise.all([
    prisma.elementoConstructivo.findUnique({
      where: { id: datos.elementoId },
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

  if (!elemento) throw new ErrorApi(404, 'El elemento constructivo no existe')
  if (!cuadrilla) throw new ErrorApi(404, 'La cuadrilla no existe')

  if (elemento.zona.piso.torre.proyectoId !== cuadrilla.proyectoId) {
    throw new ErrorApi(
      409,
      `La cuadrilla ${cuadrilla.nombre} no pertenece al proyecto de ${elemento.zona.piso.torre.nombre}`,
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
 * Valida que el cambio de fecha no desordene la cadena:
 * la apertura no puede quedar despues de su primer avance, ni un avance
 * antes del anterior o despues del siguiente.
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

/** Codigo de tarea nueva (TA01, TA02...), a partir del mayor existente. */
export async function siguienteCodigoDeTarea() {
  const tareas = await prisma.tarea.findMany({ select: { codigo: true } })
  const numeros = tareas
    .map((t) => Number(t.codigo.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n))
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1
  return `TA${String(siguiente).padStart(2, '0')}`
}

/** Relaciones de una tarea para mostrarla. */
export const relacionesTarea = {
  elemento: ubicacionElemento,
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
  /// Obra que nacio de la tarea, con sus avances.
  registro: {
    select: {
      id: true,
      codigoRegistro: true,
      fechaEjecucion: true,
      m2Ejecutados: true,
      cantidadTotal: true,
      avances: { select: { m2Ejecutados: true } },
    },
  },
} as const

/**
 * Actualiza el estado de una tarea segun su obra:
 * sin jornadas = PENDIENTE, con jornadas = EN_PROCESO, al 100% = TERMINADO.
 * SUSPENDIDO lo pone el residente y no se toca.
 */
export async function sincronizarEstadoTarea(tareaId: number | null | undefined) {
  if (!tareaId) return

  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    select: {
      estado: true,
      elemento: { select: { largo: true, alto: true, areaVanos: true } },
      registro: {
        select: {
          largo: true,
          alto: true,
          cantidadTotal: true,
          m2Ejecutados: true,
          avances: { select: { m2Ejecutados: true } },
        },
      },
    },
  })
  if (!tarea || tarea.estado === 'SUSPENDIDO') return

  // Se usa la cantidad copiada en la obra, no la del elemento actual.
  const total = tarea.registro
    ? cantidadDeObra(tarea.registro)
    : Number(String(tarea.elemento.largo)) * Number(String(tarea.elemento.alto)) -
      Number(String(tarea.elemento.areaVanos))
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

/** Tarea de una obra (solo la lleva el registro que abre la obra). */
export async function tareaDeLaObra(raizId: number) {
  const raiz = await prisma.registroEjecucion.findUnique({
    where: { id: raizId },
    select: { tareaId: true },
  })
  return raiz?.tareaId ?? null
}

/**
 * Valida que una obra pueda nacer de la tarea:
 * la tarea no tiene obra todavia y coinciden elemento y actividad.
 */
export async function validarTareaParaObra(
  tareaId: number,
  datos: { elementoId: number; actividadId: number },
  registroActualId?: number,
) {
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    select: {
      codigo: true,
      elementoId: true,
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

  if (tarea.elementoId !== datos.elementoId || tarea.actividadId !== datos.actividadId) {
    throw new ErrorApi(
      409,
      `El registro tiene que ser del mismo elemento y la misma actividad de la tarea ${tarea.codigo}`,
    )
  }
}

/**
 * Medidas del elemento y cantidad total de la obra, segun la unidad:
 * m2 = largo x alto, ml = largo; und, m3 y kg los escribe el residente.
 * El registro de apertura guarda una copia de estos valores.
 */
export async function cantidadParaObra(
  elementoId: number,
  actividadId: number,
  cantidadCapturada: number | null | undefined,
) {
  const [elemento, actividad] = await Promise.all([
    prisma.elementoConstructivo.findUnique({
      where: { id: elementoId },
      select: { codigoDwg: true, descripcion: true, largo: true, alto: true, areaVanos: true },
    }),
    prisma.actividad.findUnique({
      where: { id: actividadId },
      select: { nombre: true, unidadMedida: true },
    }),
  ])
  if (!elemento) throw new ErrorApi(404, 'El elemento constructivo no existe')
  if (!actividad) throw new ErrorApi(404, 'La actividad no existe')

  const largo = Number(String(elemento.largo))
  const alto = Number(String(elemento.alto))
  const unidad = normalizarUnidad(actividad.unidadMedida)

  const areaVanos = Number(String(elemento.areaVanos))
  const deducida = cantidadDelElemento(unidad, largo, alto, areaVanos)
  const cantidad = deducida ?? cantidadCapturada ?? null

  if (cantidad === null || !(cantidad > 0)) {
    throw new ErrorApi(
      422,
      `${actividad.nombre} se mide en ${unidad}: escribe la cantidad total que hay que ejecutar en ${elemento.codigoDwg}`,
    )
  }

  return { largo, alto, cantidad, unidad, modo: modoCantidad(unidad), elemento, actividad }
}

/**
 * Solo puede haber una obra por elemento y actividad.
 * El trabajo de otro dia sobre el mismo elemento es un avance, no una obra nueva.
 */
export async function validarObraUnica(
  elementoId: number,
  actividadId: number,
  registroActualId?: number,
) {
  const existente = await prisma.registroEjecucion.findFirst({
    where: {
      elementoId,
      actividadId,
      registroOrigenId: null,
      ...(registroActualId ? { id: { not: registroActualId } } : {}),
    },
    select: {
      codigoRegistro: true,
      elemento: { select: { codigoDwg: true } },
      actividad: { select: { nombre: true } },
    },
  })
  if (existente) {
    throw new ErrorApi(
      409,
      `${existente.elemento.codigoDwg} ya tiene la obra ${existente.codigoRegistro} de ${existente.actividad.nombre}. Registra el trabajo como avance de esa obra.`,
    )
  }
}

/**
 * Solo puede haber una tarea por elemento y actividad, y ninguna si ya hay
 * una obra abierta sin tarea.
 */
export async function validarTareaUnica(
  elementoId: number,
  actividadId: number,
  tareaActualId?: number,
) {
  const [otraTarea, obra] = await Promise.all([
    prisma.tarea.findFirst({
      where: {
        elementoId,
        actividadId,
        ...(tareaActualId ? { id: { not: tareaActualId } } : {}),
      },
      select: { codigo: true },
    }),
    prisma.registroEjecucion.findFirst({
      where: { elementoId, actividadId, registroOrigenId: null },
      select: { codigoRegistro: true, tareaId: true },
    }),
  ])

  if (otraTarea) {
    throw new ErrorApi(
      409,
      `Ya existe la tarea ${otraTarea.codigo} para ese elemento y esa actividad. Editala en lugar de crear otra.`,
    )
  }
  if (obra && (!tareaActualId || obra.tareaId !== tareaActualId)) {
    throw new ErrorApi(
      409,
      `Ese trabajo ya tiene la obra ${obra.codigoRegistro} abierta: no hace falta encargarlo otra vez.`,
    )
  }
}

/**
 * Exige que el trabajador tenga precio acordado para la actividad.
 * Responde con el codigo SIN_PRECIO para que la pantalla muestre la ventana de error.
 */
export async function exigirPrecioAcordado(
  trabajadorId: number | null | undefined,
  actividadId: number,
) {
  if (!trabajadorId) return

  const [tarifa, trabajador, actividad] = await Promise.all([
    prisma.trabajadorActividad.findUnique({
      where: { trabajadorId_actividadId: { trabajadorId, actividadId } },
      select: { id: true },
    }),
    prisma.trabajador.findUnique({
      where: { id: trabajadorId },
      select: { nombre: true, apellido: true },
    }),
    prisma.actividad.findUnique({ where: { id: actividadId }, select: { nombre: true } }),
  ])

  if (tarifa) return

  const quien = trabajador ? `${trabajador.nombre} ${trabajador.apellido}` : 'El trabajador'
  const que = actividad?.nombre ?? 'esta actividad'
  throw new ErrorApi(
    409,
    `${quien} no tiene precio acordado para ${que}. Acuerda el precio en su ficha (Trabajadores) y vuelve a guardar.`,
    'SIN_PRECIO',
  )
}
