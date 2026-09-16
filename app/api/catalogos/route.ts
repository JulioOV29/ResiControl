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
 */
export async function GET() {
  try {
    await exigirSesion()

    const [proyectos, torres, pisos, zonas, actividades, cuadrillas, trabajadores, cargos] =
      await Promise.all([
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
      ])

    return ok({ proyectos, torres, pisos, zonas, actividades, cuadrillas, trabajadores, cargos })
  } catch (error) {
    return manejarError(error)
  }
}
