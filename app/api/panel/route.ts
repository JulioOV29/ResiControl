import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirSesion } from '@/lib/api'
import { camposPanel, filtroRegistros } from '@/lib/consultas'
import {
  agregarIndicadores,
  agruparIndicadores,
  areaDeObra,
  claveDeObra,
  indicadoresJornada,
} from '@/lib/calculos'

/**
 * Todo lo que pinta el panel, calculado en el servidor a partir de los mismos
 * filtros que ve el residente.
 *
 * Se calcula aqui y no en el navegador por dos razones: con muchos registros
 * el navegador se arrastraria, y asi las graficas usan exactamente las mismas
 * formulas de lib/calculos que la pantalla de ejecucion y los informes, sin
 * riesgo de que dos sitios den numeros distintos.
 */
export async function GET(request: Request) {
  try {
    await exigirSesion()
    const parametros = new URL(request.url).searchParams

    // Las dos consultas salen a la vez: son independientes y encadenarlas era
    // pagar dos veces la latencia de ir hasta la base.
    const [registros, extremos] = await Promise.all([
      prisma.registroEjecucion.findMany({
        where: filtroRegistros(parametros),
        orderBy: { fechaEjecucion: 'asc' },
        // Solo las columnas que entran en algun calculo o en alguna etiqueta.
        // Aqui no se pagina a proposito: un indicador calculado sobre media
        // lista es un numero equivocado, no un numero incompleto.
        select: camposPanel,
      }),
      // Rango de fechas disponible, para proponer el filtro la primera vez.
      prisma.registroEjecucion.aggregate({
        _min: { fechaEjecucion: true },
        _max: { fechaEjecucion: true },
      }),
    ])

    const indicadores = agregarIndicadores(registros)

    const soloFecha = (f: Date | null) => (f ? f.toISOString().slice(0, 10) : null)

    // --- Corte por actividad -------------------------------------------------
    // Cuanto se hizo de pañete, de estuco, de mamposteria... en el lapso que
    // marcan los filtros. Va encima de la produccion por dia, que responde
    // "cuanto" pero no "de que".
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
        // La parte que le toca de la produccion del periodo.
        participacion:
          indicadores.m2Ejecutados > 0 ? a.m2Ejecutados / indicadores.m2Ejecutados : 0,
      }))
      .sort((a, b) => b.m2Ejecutados - a.m2Ejecutados)

    // --- Corte por dia -------------------------------------------------------
    // Solo aparecen los dias con registros: un dia sin trabajo no ocupa lugar.

    // Reparto de cada dia entre actividades, para que la vista de tabla de la
    // grafica muestre el desglose sin depender de pasar el mouse por encima.
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
        // La meta del dia sale de los m2Meta que lleva cada registro. Es lo que
        // permite dibujar la curva acumulada de real contra planificado sin
        // inventarse un programa de obra que el sistema no tiene.
        m2Meta: d.m2Meta,
        horasEfectivas: d.horasEfectivas,
        rendimiento: d.rendimiento,
        registros: d.registros,
        porActividad: repartoDelDia.get(d.clave) ?? {},
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))

    // --- Corte por ubicacion -------------------------------------------------
    // Baja de nivel segun hasta donde haya filtrado: si eligio una torre, la
    // grafica pasa a mostrar sus pisos, y asi sucesivamente.
    const hay = (clave: string) => Boolean(Number(parametros.get(clave)))
    const nivel = hay('zonaId')
      ? 'frente'
      : hay('pisoId')
        ? 'zona'
        : hay('torreId')
          ? 'piso'
          : 'torre'

    const claveUbicacion = (r: (typeof registros)[number]) => {
      const z = r.frente.zona
      if (nivel === 'frente') return String(r.frente.id)
      if (nivel === 'zona') return String(z.id)
      if (nivel === 'piso') return String(z.piso.id)
      return String(z.piso.torre.id)
    }

    const etiquetaUbicacion = (r: (typeof registros)[number]) => {
      const z = r.frente.zona
      if (nivel === 'frente') return `${r.frente.codigoDwg} ${r.frente.descripcion}`
      if (nivel === 'zona') return z.nombre
      if (nivel === 'piso') return z.piso.nombre || `Piso ${z.piso.numero}`
      return z.piso.torre.nombre
    }

    const porUbicacion = agruparIndicadores(registros, claveUbicacion, etiquetaUbicacion)
      .map((u) => ({
        clave: u.clave,
        etiqueta: u.etiqueta,
        m2Totales: u.m2Totales,
        m2Ejecutados: u.m2Ejecutados,
        m2Pendientes: u.m2Pendientes,
        avance: u.avance,
        obras: u.obras,
      }))
      .sort((a, b) => b.m2Totales - a.m2Totales)

    // --- Corte por cuadrilla -------------------------------------------------
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

    // --- Obras terminadas ----------------------------------------------------
    const acumuladoPorObra = new Map<number, { area: number; hecho: number }>()
    for (const r of registros) {
      const clave = claveDeObra(r)
      const actual = acumuladoPorObra.get(clave) ?? { area: areaDeObra(r), hecho: 0 }
      actual.hecho += indicadoresJornada(r).m2Ejecutados
      acumuladoPorObra.set(clave, actual)
    }
    const obrasTerminadas = Array.from(acumuladoPorObra.values()).filter(
      (o) => o.area > 0 && o.hecho >= o.area - 0.005,
    ).length

    return ok({
      indicadores,
      obrasTerminadas,
      nivelUbicacion: nivel,
      porActividad,
      porDia,
      porUbicacion,
      porCuadrilla,
      rangoDisponible: {
        desde: soloFecha(extremos._min.fechaEjecucion),
        hasta: soloFecha(extremos._max.fechaEjecucion),
      },
      // El promedio de la obra filtrada: sirve de referencia en las graficas,
      // y sale de los mismos datos, no de una meta inventada.
      rendimientoPromedio: indicadores.rendimiento,
    })
  } catch (error) {
    return manejarError(error)
  }
}
