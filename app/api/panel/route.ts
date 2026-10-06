import { prisma } from '@/lib/prisma'
import { fechaExiste } from '@/lib/dominio'
import { ok, manejarError, exigirSesion } from '@/lib/api'
import { camposIndicadores, camposPanel, filtroRegistros } from '@/lib/consultas'
import {
  agregarIndicadores,
  agruparIndicadores,
  claveDeObra,
  indicadoresJornada,
} from '@/lib/calculos'

/** Todos los datos del panel, calculados en el servidor con los filtros elegidos. */
export async function GET(request: Request) {
  try {
    await exigirSesion()
    const parametros = new URL(request.url).searchParams

    // Las dos consultas van en paralelo. La unidad se aplica despues.
    const sinUnidad = new URLSearchParams(parametros)
    sinUnidad.delete('unidad')

    const [todas, extremos] = await Promise.all([
      prisma.registroEjecucion.findMany({
        where: filtroRegistros(sinUnidad),
        orderBy: { fechaEjecucion: 'asc' },
        // Sin paginar: un indicador sobre media lista seria un numero equivocado.
        select: camposPanel,
      }),
      // Rango de fechas con registros, para el filtro inicial.
      prisma.registroEjecucion.aggregate({
        _min: { fechaEjecucion: true },
        _max: { fechaEjecucion: true },
      }),
    ])

    /**
     * El panel mide en una sola unidad (m2, ml, und...): la pedida, o la que
     * mas jornadas tiene. Las demas se ofrecen en el selector.
     */
    const cuentaPorUnidad = new Map<string, number>()
    for (const r of todas) {
      const u = r.actividad.unidadMedida
      cuentaPorUnidad.set(u, (cuentaPorUnidad.get(u) ?? 0) + 1)
    }
    const unidades = [...cuentaPorUnidad.entries()]
      .map(([unidad, registros]) => ({ unidad, registros }))
      .sort((a, b) => b.registros - a.registros || a.unidad.localeCompare(b.unidad))

    const pedida = parametros.get('unidad')
    const unidad = unidades.some((u) => u.unidad === pedida)
      ? (pedida as string)
      : (unidades[0]?.unidad ?? pedida ?? 'm2')

    const registros = todas.filter((r) => r.actividad.unidadMedida === unidad)

    /**
     * Cadenas completas de las obras del periodo, hasta la fecha "hasta".
     * Asi el avance es el estado al cierre del periodo.
     */
    const clavesDeObra = [...new Set(registros.map(claveDeObra))]
    // Solo una fecha bien escrita; si no, se ignora.
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

    const indicadores = agregarIndicadores(registros, cadenas)

    const soloFecha = (f: Date | null) => (f ? f.toISOString().slice(0, 10) : null)

    // --- Por actividad ---
    const porActividad = agruparIndicadores(
      registros,
      (r) => String(r.actividadId),
      (r) => r.actividad?.nombre ?? 'Sin actividad',
    )
      .map((a) => ({
        clave: a.clave,
        etiqueta: a.etiqueta,
        m2Ejecutados: a.m2Ejecutados,
        horasEfectivas: a.horasEfectivas,
        rendimiento: a.rendimiento,
        cumplimiento: a.cumplimiento,
        obras: a.obras,
        registros: a.registros,
        // Parte de la produccion del periodo.
        participacion:
          indicadores.m2Ejecutados > 0 ? a.m2Ejecutados / indicadores.m2Ejecutados : 0,
      }))
      .sort((a, b) => b.m2Ejecutados - a.m2Ejecutados)

    // --- Por dia (solo dias con registros) ---

    // Reparto del dia por actividad, para la tabla de la grafica.
    const repartoDelDia = new Map<string, Record<string, number>>()
    for (const r of registros) {
      const dia = r.fechaEjecucion.toISOString().slice(0, 10)
      const fila = repartoDelDia.get(dia) ?? {}
      const actividad = String(r.actividadId)
      fila[actividad] = (fila[actividad] ?? 0) + indicadoresJornada(r).m2Ejecutados
      repartoDelDia.set(dia, fila)
    }

    const porDia = agruparIndicadores(
      registros,
      (r) => r.fechaEjecucion.toISOString().slice(0, 10),
    )
      .map((d) => ({
        fecha: d.clave,
        m2Ejecutados: d.m2Ejecutados,
        // Meta del dia = suma de las metas de sus registros.
        m2Meta: d.m2Meta,
        horasEfectivas: d.horasEfectivas,
        rendimiento: d.rendimiento,
        registros: d.registros,
        porActividad: repartoDelDia.get(d.clave) ?? {},
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))

    // --- Por ubicacion: baja un nivel segun el filtro (torre -> pisos -> zonas) ---
    const hay = (clave: string) => Boolean(Number(parametros.get(clave)))
    const nivel = hay('zonaId')
      ? 'elemento'
      : hay('pisoId')
        ? 'zona'
        : hay('torreId')
          ? 'piso'
          : 'torre'

    const claveUbicacion = (r: (typeof registros)[number]) => {
      const z = r.elemento.zona
      if (nivel === 'elemento') return String(r.elemento.id)
      if (nivel === 'zona') return String(z.id)
      if (nivel === 'piso') return String(z.piso.id)
      return String(z.piso.torre.id)
    }

    const etiquetaUbicacion = (r: (typeof registros)[number]) => {
      const z = r.elemento.zona
      if (nivel === 'elemento') return `${r.elemento.codigoDwg} ${r.elemento.descripcion}`
      if (nivel === 'zona') return z.nombre
      if (nivel === 'piso') return z.piso.nombre || `Piso ${z.piso.numero}`
      return z.piso.torre.nombre
    }

    const porUbicacion = agruparIndicadores(
      registros,
      claveUbicacion,
      etiquetaUbicacion,
      cadenas,
    )
      .map((u) => ({
        clave: u.clave,
        etiqueta: u.etiqueta,
        m2Totales: u.m2Totales,
        m2Ejecutados: u.m2Ejecutados,
        m2Acumulados: u.m2Acumulados,
        m2Pendientes: u.m2Pendientes,
        avance: u.avance,
        obras: u.obras,
      }))
      .sort((a, b) => b.m2Totales - a.m2Totales)

    // --- Por cuadrilla ---
    const porCuadrilla = agruparIndicadores(
      registros,
      (r) => String(r.cuadrillaId),
      (r) => r.cuadrilla?.nombre ?? 'Sin cuadrilla',
    )
      .map((c) => ({
        clave: c.clave,
        etiqueta: c.etiqueta,
        m2Ejecutados: c.m2Ejecutados,
        horasEfectivas: c.horasEfectivas,
        rendimiento: c.rendimiento,
        cumplimiento: c.cumplimiento,
        registros: c.registros,
      }))
      .sort((a, b) => (b.rendimiento ?? 0) - (a.rendimiento ?? 0))

    return ok({
      unidad,
      unidades,
      indicadores,
      // Obras al 100% (con sus cadenas completas).
      obrasTerminadas: indicadores.obrasTerminadas,
      nivelUbicacion: nivel,
      porActividad,
      porDia,
      porUbicacion,
      porCuadrilla,
      rangoDisponible: {
        desde: soloFecha(extremos._min.fechaEjecucion),
        hasta: soloFecha(extremos._max.fechaEjecucion),
      },
      // Rendimiento promedio, como referencia en las graficas.
      rendimientoPromedio: indicadores.rendimiento,
    })
  } catch (error) {
    return manejarError(error)
  }
}
