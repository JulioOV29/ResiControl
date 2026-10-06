import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion, sinPrecios } from '@/lib/api'
import { filtroRegistros, ultimoDeCadena } from '@/lib/consultas'
import { indicadoresObra } from '@/lib/calculos'

/**
 * Obras (cadenas de registros) con sus avances y el ultimo registro,
 * que es al que se encadena el siguiente avance.
 * Con abiertas=1 solo devuelve las que no han llegado al 100%.
 */
export async function GET(request: Request) {
  try {
    const sesion = await exigirSesion()
    const parametros = new URL(request.url).searchParams
    parametros.set('soloAperturas', '1')

    const raices = await prisma.registroEjecucion.findMany({
      where: filtroRegistros(parametros),
      orderBy: [{ fechaEjecucion: 'desc' }, { id: 'desc' }],
      include: {
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
        // Los numeros de la obra salen de lib/calculos, igual que en el resto de la app.
        const ind = indicadoresObra(raiz)

        // Ultimo registro de la cadena.
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

    return ok(sinPrecios(obras, sesion.user.rol))
  } catch (error) {
    return manejarError(error)
  }
}
