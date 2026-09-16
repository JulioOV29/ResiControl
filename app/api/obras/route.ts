import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion } from '@/lib/api'
import { filtroRegistros, ultimoDeCadena } from '@/lib/consultas'
import { indicadoresObra } from '@/lib/calculos'

/**
 * Las obras abiertas, es decir las cadenas de registros. Cada una viene con el
 * registro que la abrio, todos sus avances y el ultimo de la cadena, que es al
 * que hay que encadenar el siguiente avance.
 *
 * Con abiertas=1 devuelve solo las que no han llegado al 100%, que es lo que
 * necesita el formulario de "nuevo registro de avance".
 */
export async function GET(request: Request) {
  try {
    await exigirSesion()
    const parametros = new URL(request.url).searchParams
    parametros.set('soloAperturas', '1')

    const raices = await prisma.registroEjecucion.findMany({
      where: filtroRegistros(parametros),
      orderBy: [{ fechaEjecucion: 'desc' }, { id: 'desc' }],
      include: {
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
                    numero: true,
                    nombre: true,
                    torre: {
                      select: {
                        nombre: true,
                        proyecto: { select: { id: true, codigo: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        actividad: { select: { id: true, nombre: true } },
        cuadrilla: { select: { id: true, nombre: true } },
        trabajador: { select: { id: true, nombre: true, apellido: true } },
        avances: {
          orderBy: { fechaEjecucion: 'asc' },
          select: {
            id: true,
            codigoRegistro: true,
            fechaEjecucion: true,
            m2Ejecutados: true,
            horaInicio: true,
            horaFinal: true,
            tiempoRecesoMin: true,
            m2Meta: true,
            registroAnteriorId: true,
            numeroAvance: true,
            continuacion: { select: { id: true } },
          },
        },
        continuacion: { select: { id: true } },
      },
    })

    const soloAbiertas = parametros.get('abiertas') === '1'

    const obras = raices
      .map((raiz) => {
        // La aritmetica de la obra sale de lib/calculos, la misma que usan el
        // panel y la pantalla de ejecucion. Estaba repetida aqui y repetir una
        // formula es la manera segura de que dos pantallas acaben dando cifras
        // distintas para la misma obra.
        const ind = indicadoresObra(raiz)

        // El ultimo eslabon es el unico que todavia no tiene continuacion.
        const ultimo = ultimoDeCadena(raiz, raiz.avances)

        return {
          ...raiz,
          resumen: {
            total: ind.m2Totales,
            ejecutado: ind.m2Ejecutados,
            pendiente: ind.m2Pendientes,
            avance: ind.avance,
            completada: ind.completada,
            jornadas: ind.jornadas,
            horasEfectivas: ind.horasEfectivas,
            rendimiento: ind.rendimiento,
            ultimoId: ultimo.id,
            ultimoCodigo: ultimo.codigoRegistro,
          },
        }
      })
      .filter((o) => !soloAbiertas || !o.resumen.completada)

    return ok(obras)
  } catch (error) {
    return manejarError(error)
  }
}
