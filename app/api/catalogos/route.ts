import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion } from '@/lib/api'

/**
 * Todos los catalogos para filtros y desplegables en una sola respuesta.
 * Con ?combinaciones=1 agrega las combinaciones reales (zona, actividad,
 * cuadrilla, trabajador) que usa el panel para sus filtros relacionados.
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
      // Incluye lo inactivo (marcado con activo); cada pantalla decide que mostrar.
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
      // Solo ids, una fila por combinacion distinta.
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

    // Varias filas pueden dar la misma combinacion por zona: se deja una.
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