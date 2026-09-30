import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, ErrorApi } from '@/lib/api'
import { esquemaRegistroObra, esquemaRegistroAvance } from '@/lib/esquemas'
import {
  relacionesRegistro,
  filtroRegistros,
  camposIndicadores,
  aHora,
  tarifaDeTrabajador,
  cantidadParaObra,
  validarObraUnica,
  validarCoherencia,
  exigirPrecioAcordado,
  validarTareaParaObra,
  sincronizarEstadoTarea,
  tareaDeLaObra,
} from '@/lib/consultas'
import { agregarIndicadores, cantidadDeObra, claveDeObra, num } from '@/lib/calculos'

/**
 * Cuantas filas se mandan al navegador de una vez. La tabla no puede crecer sin
 * limite: con unos miles de registros la respuesta pesaria megabytes y el
 * navegador tardaria mas en pintarla que la base en calcularla.
 */
const LIMITE = 500

/**
 * La lista de registros y su resumen.
 *
 * El resumen NO sale de las filas que se devuelven, sino de todo lo que cumple
 * el filtro, con una consulta aparte que trae solo las columnas que entran en
 * las formulas. Si saliera de la pagina, al pasar de LIMITE el residente veria
 * una produccion menor que la real y sin ninguna senal de que falta algo.
 * De paso es mas barato: antes el navegador recibia todas las relaciones de
 * todas las filas para acabar sumando dos columnas.
 */
export async function GET(request: Request) {
  try {
    await exigirSesion()
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

    // El estado de cada obra (area, pendiente, avance) sale de su cadena
    // completa, no solo de las jornadas que caen dentro del filtro: lo que le
    // falta a un muro no cambia porque se acote el rango de fechas.
    const clavesDeObra = [...new Set(paraResumen.map(claveDeObra))]
    const hasta = parametros.get('hasta')
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

    /**
     * Un resumen por unidad de medida. Sumar m2 de pañete con metros lineales
     * de filo y con tomacorrientes da un numero que no es nada, asi que cada
     * unidad lleva sus propios indicadores. Van de la que mas jornadas tiene a
     * la que menos, y la pantalla muestra la primera mientras no se elija otra.
     */
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
      registros,
      resumenes,
      truncado: paraResumen.length > registros.length,
    })
  } catch (error) {
    return manejarError(error)
  }
}

/**
 * Codigo de una obra nueva: R01, R02... Solo cuentan los registros que abren
 * obra, y se toma el maximo existente en lugar de contar filas, para que
 * borrar un registro no genere codigos repetidos.
 */
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
 * Crea un registro. El cuerpo decide de que tipo es:
 *   con registroAnteriorId  -> avance de una obra ya abierta
 *   sin el                  -> registro que abre una obra nueva
 */
export async function POST(request: Request) {
  try {
    const sesion = await exigirPermiso('registrar')
    const cuerpo = await request.json()
    const esAvance = Boolean(cuerpo?.registroAnteriorId)

    if (!esAvance) {
      const { horaInicio, horaFinal, tareaId, cantidadTotal, ...datos } =
        esquemaRegistroObra.parse(cuerpo)

      await validarCoherencia(datos)
      // Sin precio acordado no se asigna: el trabajo quedaria sin poder pagarse.
      await exigirPrecioAcordado(datos.trabajadorId, datos.actividadId)
      // Un muro con una actividad es UNA obra: el segundo dia es un avance.
      await validarObraUnica(datos.elementoId, datos.actividadId)
      // Si la obra nace de una tarea asignada, esa tarea tiene que estar libre
      // y hablar del mismo elemento y la misma actividad.
      if (tareaId) await validarTareaParaObra(tareaId, datos)

      // Las medidas salen del elemento constructivo, no del navegador, y se
      // copian a la jornada junto con la cantidad total, que es lo que fija el
      // 100% de esta obra en la unidad de su actividad.
      const medidas = await cantidadParaObra(datos.elementoId, datos.actividadId, cantidadTotal)

      if (datos.m2Ejecutados > medidas.cantidad + 0.005) {
        throw new ErrorApi(
          409,
          `La obra de ${medidas.actividad.nombre} en ${medidas.elemento.codigoDwg} es de ${medidas.cantidad.toFixed(2)} ${medidas.unidad}: no se puede ejecutar mas que eso`,
        )
      }

      const [codigoRegistro, valorM2] = await Promise.all([
        siguienteCodigoDeObra(),
        // El precio es el del trabajador para esa actividad, no el de la
        // actividad: el mismo pañete se paga distinto segun quien lo haga.
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
          // La tarifa queda congelada en la jornada, como la meta.
          valorM2,
          horaInicio: aHora(horaInicio),
          horaFinal: aHora(horaFinal),
          usuarioRegistraId: sesion.user.id,
        },
        include: relacionesRegistro,
      })

      // La tarea pasa a EN_PROCESO sola, o a TERMINADO si la obra se cerro el
      // mismo dia que se abrio.
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

    // La cadena es lineal: cada registro tiene como mucho un avance detras.
    if (anterior.continuacion) {
      throw new ErrorApi(
        409,
        `El registro ${anterior.codigoRegistro} ya tiene un avance (${anterior.continuacion.codigoRegistro}). Encadena el nuevo a ese.`,
      )
    }

    if (datos.fechaEjecucion < anterior.fechaEjecucion) {
      throw new ErrorApi(409, 'El avance no puede ser anterior al registro que continua')
    }

    // La obra es la del registro que la abrio, que puede ser el anterior mismo.
    const raizId = anterior.registroOrigenId ?? anterior.id

    await validarCoherencia({
      // La ubicacion y la actividad las hereda del anterior.
      elementoId: anterior.elementoId,
      cuadrillaId: datos.cuadrillaId,
      trabajadorId: datos.trabajadorId,
      fechaEjecucion: datos.fechaEjecucion,
    })

    // La actividad es la de la obra: quien trabaja hoy tiene que tener precio
    // acordado para ella.
    await exigirPrecioAcordado(datos.trabajadorId, anterior.actividadId)

    const codigoObra = anterior.registroOrigen?.codigoRegistro ?? anterior.codigoRegistro
    // La actividad la hereda del anterior; el precio sale del trabajador de
    // ESTA jornada y de lo que valia hoy, no de quien abrio la obra ni de lo
    // que valia entonces.
    const valorM2 = await tarifaDeTrabajador(datos.trabajadorId, anterior.actividadId)

    /**
     * Lo que queda por ejecutar se vuelve a medir DENTRO de la transaccion, con
     * la fila de la obra bloqueada.
     *
     * Comprobar fuera y crear despues dejaba una ventana: dos avances guardados
     * a la vez leian el mismo pendiente y la obra acababa por encima del 100%.
     * El bloqueo tambien sirve para que el numero de subregistro no se repita.
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

      // El subregistro se identifica con el codigo de su obra mas su numero:
      // R40-SR1, R40-SR2. En pantalla se muestra partido en dos columnas.
      const numeroAvance =
        Math.max(0, ...raiz.avances.map((a) => a.numeroAvance ?? 0)) + 1

      return tx.registroEjecucion.create({
        data: {
          ...datos,
          valorM2,
          // La ubicacion y la actividad se heredan: un avance pertenece a la
          // misma obra, no puede cambiar de muro ni de actividad a mitad.
          elementoId: anterior.elementoId,
          actividadId: anterior.actividadId,
          registroAnteriorId: anterior.id,
          registroOrigenId: raizId,
          numeroAvance,
          codigoRegistro: `${codigoObra}-SR${numeroAvance}`,
          horaInicio: aHora(horaInicio),
          horaFinal: aHora(horaFinal),
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
