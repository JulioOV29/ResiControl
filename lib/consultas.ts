/**
 * Piezas de consulta compartidas entre rutas. Viven aqui y no en un route.ts
 * porque Next.js solo admite exportar los manejadores HTTP desde esos archivos.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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
 * La tarifa vigente de una actividad, para congelarla en la jornada que se esta
 * guardando.
 *
 * Es la misma idea que ya se aplica con la meta: lo que vale el trabajo se
 * decide el dia que se hace. Si la tarifa se leyera al liquidar en vez de
 * guardarse aqui, subir el precio del pañete en marzo cambiaria de golpe lo que
 * se pago en enero, y eso no es un indicador desactualizado sino una cuenta
 * equivocada.
 */
export async function tarifaDeActividad(actividadId: number) {
  const actividad = await prisma.actividad.findUnique({
    where: { id: actividadId },
    select: { valorM2: true },
  })
  return actividad?.valorM2 ?? null
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
