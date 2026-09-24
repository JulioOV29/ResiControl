import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion } from '@/lib/api'

/**
 * Todo lo que necesitan los desplegables de una pantalla, en una sola
 * respuesta.
 *
 * Existe por un problema medido: el panel abria ocho peticiones solo para
 * llenar sus filtros, y cada una era un viaje completo a Neon. Ademas pedia las
 * entidades enteras, con sus conteos y sus relaciones, para acabar pintando un
 * nombre en un <option>.
 *
 * Aqui van los mismos catalogos con los campos justos y las consultas en
 * paralelo. La jerarquia de ubicacion viene completa a proposito: son pocas
 * filas y asi elegir una torre filtra sus pisos en el navegador, sin volver a
 * preguntar al servidor.
 *
 * Esto NO sustituye a /api/proyectos, /api/torres y compania: esas siguen
 * sirviendo a las pantallas de gestion, donde si hacen falta los conteos y el
 * detalle. Este endpoint es de solo lectura y solo para filtros.
 *
 * Con ?combinaciones=1 anade ademas las combinaciones (zona, actividad,
 * cuadrilla, trabajador) que existen de verdad en los registros. Es lo que usa
 * el panel para que sus filtros se condicionen entre si sin volver al
 * servidor en cada clic. Las demas pantallas no lo piden y no lo pagan.
 */
export async function GET(request: Request) {
  try {
    await exigirSesion()

    const conCombinaciones = new URL(request.url).searchParams.get('combinaciones') === '1'

    const [
      proyectos,
      torres,
      pisos,
      zonas,
      actividades,
      cuadrillas,
      trabajadores,
      cargos,
      registros,
    ] = await Promise.all([
      prisma.proyecto.findMany({
        orderBy: { codigo: 'asc' },
        select: { id: true, codigo: true, nombre: true },
      }),
      prisma.torre.findMany({
        orderBy: { codigo: 'asc' },
        select: { id: true, proyectoId: true, codigo: true, nombre: true },
      }),
      prisma.piso.findMany({
        orderBy: { numero: 'asc' },
        select: { id: true, torreId: true, numero: true, nombre: true },
      }),
      prisma.zona.findMany({
        orderBy: { codigo: 'asc' },
        select: { id: true, pisoId: true, codigo: true, nombre: true },
      }),
      // Lo de baja viaja tambien, marcado con activo. Un filtro tiene que
      // poder buscar por la cuadrilla que trabajo el mes pasado aunque hoy
      // este desactivada; un formulario de alta, en cambio, solo ofrece las
      // activas. Cada pantalla decide, aqui no se esconde nada.
      prisma.actividad.findMany({
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, unidadMedida: true, activo: true },
      }),
      prisma.cuadrilla.findMany({
        orderBy: { nombre: 'asc' },
        select: { id: true, proyectoId: true, nombre: true, activo: true },
      }),
      prisma.trabajador.findMany({
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true, apellido: true, cargoId: true, activo: true },
      }),
      prisma.cargo.findMany({
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true },
      }),
      // Solo identificadores, sin fechas: distinct deja una fila por cada
      // elemento, actividad, cuadrilla y trabajador que hayan coincidido, y no
      // una por jornada. Con miles de registros sigue siendo una lista corta.
      conCombinaciones
        ? prisma.registroEjecucion.findMany({
            distinct: ['elementoId', 'actividadId', 'cuadrillaId', 'trabajadorId'],
            select: {
              elementoId: true,
              actividadId: true,
              cuadrillaId: true,
              trabajadorId: true,
              elemento: { select: { zonaId: true } },
            },
          })
        : Promise.resolve(null),
    ])

    // Varios elementos de una misma zona dan la misma combinacion: se quedan
    // con una sola.
    let combinaciones: Array<[number, number, number, number | null]> | undefined
    if (registros) {
      const vistas = new Set<string>()
      combinaciones = []
      for (const r of registros) {
        const clave = `${r.elemento.zonaId}-${r.actividadId}-${r.cuadrillaId}-${r.trabajadorId}`
        if (vistas.has(clave)) continue
        vistas.add(clave)
        combinaciones.push([r.elemento.zonaId, r.actividadId, r.cuadrillaId, r.trabajadorId])
      }
    }

    return ok({
      proyectos,
      torres,
      pisos,
      zonas,
      actividades,
      cuadrillas,
      trabajadores,
      cargos,
      ...(combinaciones ? { combinaciones } : {}),
    })
  } catch (error) {
    return manejarError(error)
  }
}