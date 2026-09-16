import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, exigirPermiso, ErrorApi } from '@/lib/api'
import { esquemaRegistroObra, esquemaRegistroAvance } from '@/lib/esquemas'
import {
  relacionesRegistro,
  filtroRegistros,
  camposIndicadores,
  aHora,
  estadoDeObra,
  tarifaDeActividad,
} from '@/lib/consultas'
import { agregarIndicadores } from '@/lib/calculos'

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
      prisma.registroEjecucion.findMany({ where, select: camposIndicadores }),
    ])

    return ok({
      registros,
      resumen: agregarIndicadores(paraResumen),
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
 * Numero del subregistro dentro de su obra: SR1, SR2, SR3... Tambien sobre el
 * maximo, por la misma razon.
 */
async function siguienteNumeroDeAvance(raizId: number) {
  const avances = await prisma.registroEjecucion.findMany({
    where: { registroOrigenId: raizId },
    select: { numeroAvance: true },
  })

  const numeros = avances
    .map((a) => a.numeroAvance ?? 0)
    .filter((n) => Number.isFinite(n))

  return (numeros.length ? Math.max(...numeros) : 0) + 1
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
      const { horaInicio, horaFinal, ...datos } = esquemaRegistroObra.parse(cuerpo)

      const [codigoRegistro, valorM2] = await Promise.all([
        siguienteCodigoDeObra(),
        tarifaDeActividad(datos.actividadId),
      ])

      const creado = await prisma.registroEjecucion.create({
        data: {
          ...datos,
          codigoRegistro,
          // La tarifa queda congelada en la jornada, como la meta.
          valorM2,
          horaInicio: aHora(horaInicio),
          horaFinal: aHora(horaFinal),
          usuarioRegistraId: sesion.user.id,
        },
        include: relacionesRegistro,
      })

      return ok(creado, 201)
    }

    const { horaInicio, horaFinal, registroAnteriorId, ...datos } =
      esquemaRegistroAvance.parse(cuerpo)

    const anterior = await prisma.registroEjecucion.findUnique({
      where: { id: registroAnteriorId },
      select: {
        id: true,
        codigoRegistro: true,
        frenteId: true,
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
    const obra = await estadoDeObra(raizId)
    if (!obra) throw new ErrorApi(404, 'No se encontro la obra')

    if (datos.m2Ejecutados > obra.pendiente + 0.005) {
      throw new ErrorApi(
        409,
        `A la obra solo le quedan ${obra.pendiente.toFixed(2)} m2 por ejecutar, de un total de ${obra.total.toFixed(2)} m2`,
      )
    }

    // El subregistro se identifica con el codigo de su obra mas su numero:
    // R40-SR1, R40-SR2. En pantalla se muestra partido en dos columnas.
    const codigoObra = anterior.registroOrigen?.codigoRegistro ?? anterior.codigoRegistro
    const [numeroAvance, valorM2] = await Promise.all([
      siguienteNumeroDeAvance(raizId),
      // La actividad la hereda del anterior, y con ella la tarifa del dia de
      // hoy, no la del dia en que se abrio la obra: cada jornada se paga a lo
      // que valia cuando se hizo.
      tarifaDeActividad(anterior.actividadId),
    ])

    const creado = await prisma.registroEjecucion.create({
      data: {
        ...datos,
        valorM2,
        // La ubicacion y la actividad se heredan: un avance pertenece a la
        // misma obra, no puede cambiar de muro ni de actividad a mitad.
        frenteId: anterior.frenteId,
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

    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
