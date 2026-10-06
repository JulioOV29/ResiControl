import { prisma } from '@/lib/prisma'
import { fechaExiste } from '@/lib/dominio'
import { ok, manejarError, exigirSesion, exigirPermiso, ErrorApi, sinPrecios } from '@/lib/api'
import { esquemaRegistroObra, esquemaRegistroAvance } from '@/lib/esquemas'
import {
  relacionesRegistro,
  filtroRegistros,
  camposIndicadores,
  tarifaDeTrabajador,
  cantidadParaObra,
  validarObraUnica,
  validarCoherencia,
  exigirPrecioAcordado,
  validarTareaParaObra,
  sincronizarEstadoTarea,
  tareaDeLaObra,
} from '@/lib/consultas'
import { agregarIndicadores, cantidadDeObra, claveDeObra, horaADate, num } from '@/lib/calculos'

/** Maximo de filas por respuesta. */
const LIMITE = 500

/**
 * Lista de registros y su resumen.
 * El resumen se calcula sobre TODO lo que cumple el filtro, no solo sobre las
 * filas devueltas.
 */
export async function GET(request: Request) {
  try {
    const sesion = await exigirSesion()
    const parametros = new URL(request.url).searchParams
    const where = filtroRegistros(parametros)

    const [registros, paraResumen] = await Promise.all([
      prisma.registroEjecucion.findMany({
        where,
        orderBy: [{ fechaEjecucion: 'desc' }, { id: 'desc' }],
        take: LIMITE,
        include: relacionesRegistro,
      }),
      prisma.registroEjecucion.findMany({
        where,
        select: { ...camposIndicadores, actividad: { select: { unidadMedida: true } } },
      }),
    ])

    // Avance y pendiente salen de la cadena completa de cada obra.
    const clavesDeObra = [...new Set(paraResumen.map(claveDeObra))]
    const hastaTexto = parametros.get('hasta')
    const hasta = hastaTexto && fechaExiste(hastaTexto) ? hastaTexto : null
    const cadenas = clavesDeObra.length
      ? await prisma.registroEjecucion.findMany({
          where: {
            OR: [
              { id: { in: clavesDeObra } },
              { registroOrigenId: { in: clavesDeObra } },
            ],
            ...(hasta ? { fechaEjecucion: { lte: new Date(`${hasta}T00:00:00.000Z`) } } : {}),
          },
          select: camposIndicadores,
        })
      : []

    /** Un resumen por unidad de medida, de la que mas jornadas tiene a la que menos. */
    const porUnidad = new Map<string, typeof paraResumen>()
    for (const r of paraResumen) {
      const unidad = r.actividad.unidadMedida
      const lista = porUnidad.get(unidad) ?? []
      lista.push(r)
      porUnidad.set(unidad, lista)
    }

    const resumenes = [...porUnidad.entries()]
      .map(([unidad, jornadas]) => {
        const obras = new Set(jornadas.map(claveDeObra))
        return {
          unidad,
          ...agregarIndicadores(
            jornadas,
            cadenas.filter((c) => obras.has(claveDeObra(c))),
          ),
        }
      })
      .sort((a, b) => b.registros - a.registros)

    return ok({
      registros: sinPrecios(registros, sesion.user.rol),
      resumenes,
      truncado: paraResumen.length > registros.length,
    })
  } catch (error) {
    return manejarError(error)
  }
}

/** Codigo de obra nueva (R01, R02...), a partir del mayor existente. */
async function siguienteCodigoDeObra() {
  const aperturas = await prisma.registroEjecucion.findMany({
    where: { registroOrigenId: null },
    select: { codigoRegistro: true },
  })

  const numeros = aperturas
    .map((r) => Number(r.codigoRegistro.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n))

  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1
  return `R${String(siguiente).padStart(2, '0')}`
}

/**
 * Crea un registro:
 *   con registroAnteriorId -> avance de una obra
 *   sin el                 -> apertura de una obra nueva
 */
export async function POST(request: Request) {
  try {
    const sesion = await exigirPermiso('registrar')
    const cuerpo = await request.json()
    const esAvance = Boolean(cuerpo?.registroAnteriorId)

    if (!esAvance) {
      const { horaInicio, horaFinal, tareaId: tareaElegida, cantidadTotal, ...datos } =
        esquemaRegistroObra.parse(cuerpo)

      await validarCoherencia(datos)
      await exigirPrecioAcordado(datos.trabajadorId, datos.actividadId)
      await validarObraUnica(datos.elementoId, datos.actividadId)

      // Si no se eligio tarea pero ese trabajo ya tiene una, la obra se enlaza a ella.
      const tareaId =
        tareaElegida ??
        (
          await prisma.tarea.findFirst({
            where: {
              elementoId: datos.elementoId,
              actividadId: datos.actividadId,
              registro: { is: null },
            },
            select: { id: true },
          })
        )?.id ??
        null
      // Si nace de una tarea, la tarea debe estar libre y coincidir.
      if (tareaId) await validarTareaParaObra(tareaId, datos)

      // Medidas y cantidad total salen del elemento, no del navegador.
      const medidas = await cantidadParaObra(datos.elementoId, datos.actividadId, cantidadTotal)

      if (datos.m2Ejecutados > medidas.cantidad + 0.005) {
        throw new ErrorApi(
          409,
          `La obra de ${medidas.actividad.nombre} en ${medidas.elemento.codigoDwg} es de ${medidas.cantidad.toFixed(2)} ${medidas.unidad}: no se puede ejecutar mas que eso`,
        )
      }

      const [codigoRegistro, valorM2] = await Promise.all([
        siguienteCodigoDeObra(),
        tarifaDeTrabajador(datos.trabajadorId, datos.actividadId),
      ])

      const creado = await prisma.registroEjecucion.create({
        data: {
          ...datos,
          largo: medidas.largo,
          alto: medidas.alto,
          cantidadTotal: medidas.cantidad,
          tareaId,
          codigoRegistro,
          // Precio copiado en la jornada.
          valorM2,
          horaInicio: horaADate(horaInicio),
          horaFinal: horaADate(horaFinal),
          usuarioRegistraId: sesion.user.id,
        },
        include: relacionesRegistro,
      })

      // Actualiza el estado de la tarea.
      await sincronizarEstadoTarea(tareaId)

      return ok(creado, 201)
    }

    const { horaInicio, horaFinal, registroAnteriorId, ...datos } =
      esquemaRegistroAvance.parse(cuerpo)

    const anterior = await prisma.registroEjecucion.findUnique({
      where: { id: registroAnteriorId },
      select: {
        id: true,
        codigoRegistro: true,
        elementoId: true,
        actividadId: true,
        registroOrigenId: true,
        fechaEjecucion: true,
        registroOrigen: { select: { codigoRegistro: true } },
        continuacion: { select: { codigoRegistro: true } },
      },
    })
    if (!anterior) throw new ErrorApi(404, 'El registro anterior no existe')

    // Un registro tiene como maximo un avance despues.
    if (anterior.continuacion) {
      throw new ErrorApi(
        409,
        `El registro ${anterior.codigoRegistro} ya tiene un avance (${anterior.continuacion.codigoRegistro}). Encadena el nuevo a ese.`,
      )
    }

    if (datos.fechaEjecucion < anterior.fechaEjecucion) {
      throw new ErrorApi(409, 'El avance no puede ser anterior al registro que continua')
    }

    // Obra a la que pertenece (la apertura).
    const raizId = anterior.registroOrigenId ?? anterior.id

    await validarCoherencia({
      // Ubicacion heredada del anterior.
      elementoId: anterior.elementoId,
      cuadrillaId: datos.cuadrillaId,
      trabajadorId: datos.trabajadorId,
      fechaEjecucion: datos.fechaEjecucion,
    })

    // El trabajador debe tener precio para la actividad de la obra.
    await exigirPrecioAcordado(datos.trabajadorId, anterior.actividadId)

    const codigoObra = anterior.registroOrigen?.codigoRegistro ?? anterior.codigoRegistro
    // Precio del trabajador de esta jornada, con el valor de hoy.
    const valorM2 = await tarifaDeTrabajador(datos.trabajadorId, anterior.actividadId)

    /**
     * El pendiente se mide dentro de la transaccion con la obra bloqueada,
     * para que dos avances simultaneos no pasen del 100% ni repitan numero.
     */
    const creado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_ejecucion FROM registros_ejecucion WHERE id_ejecucion = ${raizId} FOR UPDATE`

      const raiz = await tx.registroEjecucion.findUnique({
        where: { id: raizId },
        select: {
          largo: true,
          alto: true,
          cantidadTotal: true,
          m2Ejecutados: true,
          actividad: { select: { unidadMedida: true } },
          avances: { select: { m2Ejecutados: true, numeroAvance: true } },
        },
      })
      if (!raiz) throw new ErrorApi(404, 'No se encontro la obra')

      const total = cantidadDeObra(raiz)
      const unidad = raiz.actividad.unidadMedida
      const ejecutado =
        num(raiz.m2Ejecutados) + raiz.avances.reduce((suma, a) => suma + num(a.m2Ejecutados), 0)
      const pendiente = Math.max(0, total - ejecutado)

      if (datos.m2Ejecutados > pendiente + 0.005) {
        throw new ErrorApi(
          409,
          `A la obra solo le quedan ${pendiente.toFixed(2)} ${unidad} por ejecutar, de un total de ${total.toFixed(2)} ${unidad}`,
        )
      }

      // Codigo del avance: R40-SR1, R40-SR2...
      const numeroAvance =
        Math.max(0, ...raiz.avances.map((a) => a.numeroAvance ?? 0)) + 1

      return tx.registroEjecucion.create({
        data: {
          ...datos,
          valorM2,
          // Elemento y actividad se heredan de la obra.
          elementoId: anterior.elementoId,
          actividadId: anterior.actividadId,
          registroAnteriorId: anterior.id,
          registroOrigenId: raizId,
          numeroAvance,
          codigoRegistro: `${codigoObra}-SR${numeroAvance}`,
          horaInicio: horaADate(horaInicio),
          horaFinal: horaADate(horaFinal),
          usuarioRegistraId: sesion.user.id,
        },
        include: relacionesRegistro,
      })
    })

    await sincronizarEstadoTarea(await tareaDeLaObra(raizId))

    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
