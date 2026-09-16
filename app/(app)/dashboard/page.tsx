'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  CalendarRange,
  Gauge,
  Layers,
  Loader2,
  Percent,
  Ruler,
} from 'lucide-react'
import { useRecursoUnico, useRetardo } from '@/lib/cliente'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { Indicador } from '@/components/Indicador'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/card'
import { BarraFiltros, FiltroSeleccion, FiltroFecha } from '@/components/ui/filtros'
import { Grafica, Globo, Leyenda, Segmentado, Totales, ejeComun } from '@/components/graficas/Grafica'
import { paleta, GROSOR_BARRA } from '@/components/graficas/paleta'
import { formatoDuracion } from '@/lib/calculos'
import { formatoFecha, formatoNumero, formatoPorcentaje } from '@/lib/utils'
import type { Catalogos } from '@/types/dominio'

type Panel = {
  indicadores: {
    registros: number
    obras: number
    m2Totales: number
    m2Ejecutados: number
    m2Pendientes: number
    m2Meta: number
    horasEfectivas: number
    minutosReceso: number
    rendimiento: number | null
    cumplimiento: number | null
    avance: number | null
  }
  obrasTerminadas: number
  nivelUbicacion: 'torre' | 'piso' | 'zona' | 'frente'
  porActividad: Array<{
    clave: string
    etiqueta: string
    m2Ejecutados: number
    horasEfectivas: number
    rendimiento: number | null
    cumplimiento: number | null
    obras: number
    registros: number
    participacion: number
  }>
  porDia: Array<{
    fecha: string
    m2Ejecutados: number
    m2Meta: number
    horasEfectivas: number
    rendimiento: number | null
    registros: number
    /** m2 del dia repartidos por actividad, con el id de la actividad de clave. */
    porActividad: Record<string, number>
  }>
  porUbicacion: Array<{
    clave: string
    etiqueta: string
    m2Totales: number
    m2Ejecutados: number
    m2Pendientes: number
    avance: number | null
    obras: number
  }>
  porCuadrilla: Array<{
    clave: string
    etiqueta: string
    m2Ejecutados: number
    horasEfectivas: number
    rendimiento: number | null
    cumplimiento: number | null
    registros: number
  }>
  rangoDisponible: { desde: string | null; hasta: string | null }
  rendimientoPromedio: number | null
}

const filtrosVacios = {
  proyectoId: '',
  torreId: '',
  pisoId: '',
  zonaId: '',
  actividadId: '',
  cuadrillaId: '',
  trabajadorId: '',
  cargoId: '',
  desde: '',
  hasta: '',
}

const NOMBRE_NIVEL = {
  torre: 'torre',
  piso: 'piso',
  zona: 'zona',
  frente: 'frente de trabajo',
} as const

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const aFecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** "2026-09-09" -> "9 sep", que es como se lee una fecha en un eje. */
const fechaCorta = (iso: string) => {
  const d = aFecha(iso)
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}

type Paso = 'dia' | 'semana' | 'mes'

/** El lunes de la semana a la que pertenece una fecha, en formato aaaa-mm-dd. */
function lunesDe(iso: string) {
  const d = aFecha(iso)
  const dia = d.getUTCDay() // 0 domingo
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1))
  return d.toISOString().slice(0, 10)
}

/**
 * Agrupa los dias en el paso elegido y devuelve, ademas de lo producido en cada
 * periodo, lo acumulado hasta el.
 *
 * Los acumulados son el punto de la curva: responden "a estas alturas, cuanto
 * llevamos hecho contra cuanto deberiamos llevar", que es la pregunta que no
 * contesta una barra suelta por dia.
 */
function acumular(
  dias: Panel['porDia'],
  paso: Paso,
): Array<{
  clave: string
  etiqueta: string
  m2Ejecutados: number
  m2Meta: number
  acumulado: number
  acumuladoMeta: number
  registros: number
}> {
  const grupos = new Map<string, { m2Ejecutados: number; m2Meta: number; registros: number }>()

  for (const d of dias) {
    const clave =
      paso === 'dia' ? d.fecha : paso === 'semana' ? lunesDe(d.fecha) : d.fecha.slice(0, 7)
    const g = grupos.get(clave) ?? { m2Ejecutados: 0, m2Meta: 0, registros: 0 }
    g.m2Ejecutados += d.m2Ejecutados
    g.m2Meta += d.m2Meta
    g.registros += d.registros
    grupos.set(clave, g)
  }

  const etiquetar = (clave: string) => {
    if (paso === 'dia') return fechaCorta(clave)
    if (paso === 'semana') return `Sem ${fechaCorta(clave)}`
    const [a, m] = clave.split('-')
    return `${MESES[Number(m) - 1]} ${a}`
  }

  let acumulado = 0
  let acumuladoMeta = 0

  return Array.from(grupos.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, g]) => {
      acumulado += g.m2Ejecutados
      acumuladoMeta += g.m2Meta
      return { clave, etiqueta: etiquetar(clave), ...g, acumulado, acumuladoMeta }
    })
}

export default function DashboardPage() {
  const [filtros, setFiltros] = useState(filtrosVacios)
  const [rangoPuesto, setRangoPuesto] = useState(false)
  const [paso, setPaso] = useState<Paso>('dia')

  // Los filtros se aplican cuando el usuario deja de moverlos: un campo de
  // fecha dispara onChange varias veces mientras se escribe y no tiene sentido
  // recalcular el panel entero en cada una.
  const filtrosAplicados = useRetardo(filtros)

  const consulta = useMemo(() => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(filtrosAplicados)) if (v) p.set(k, v)
    const texto = p.toString()
    return texto ? `/api/panel?${texto}` : '/api/panel'
  }, [filtrosAplicados])

  const { dato, cargando } = useRecursoUnico<Panel>(consulta)

  // Un solo viaje para todos los desplegables. La jerarquia llega completa, asi
  // que elegir torre, piso o zona encadena los filtros sin pedir nada mas.
  const { dato: catalogos } = useRecursoUnico<Catalogos>('/api/catalogos')

  const proyectos = catalogos?.proyectos ?? []
  const actividades = catalogos?.actividades ?? []
  const trabajadores = catalogos?.trabajadores ?? []
  const cargos = catalogos?.cargos ?? []

  const torres = useMemo(
    () =>
      (catalogos?.torres ?? []).filter(
        (t) => !filtros.proyectoId || t.proyectoId === Number(filtros.proyectoId),
      ),
    [catalogos, filtros.proyectoId],
  )

  const pisos = useMemo(
    () =>
      filtros.torreId
        ? (catalogos?.pisos ?? []).filter((p) => p.torreId === Number(filtros.torreId))
        : [],
    [catalogos, filtros.torreId],
  )

  const zonas = useMemo(
    () =>
      filtros.pisoId
        ? (catalogos?.zonas ?? []).filter((z) => z.pisoId === Number(filtros.pisoId))
        : [],
    [catalogos, filtros.pisoId],
  )

  const cuadrillas = useMemo(
    () =>
      (catalogos?.cuadrillas ?? []).filter(
        (c) => !filtros.proyectoId || c.proyectoId === Number(filtros.proyectoId),
      ),
    [catalogos, filtros.proyectoId],
  )

  // La primera vez el rango se pone solo: de la obra mas antigua hasta hoy,
  // para que se vea todo y no una tajada arbitraria.
  useEffect(() => {
    if (rangoPuesto || !dato?.rangoDisponible.desde) return
    setFiltros((f) => ({
      ...f,
      desde: dato.rangoDisponible.desde!,
      hasta: new Date().toISOString().slice(0, 10),
    }))
    setRangoPuesto(true)
  }, [dato, rangoPuesto])

  const cambiar = (campos: Partial<typeof filtrosVacios>) =>
    setFiltros((f) => ({ ...f, ...campos }))

  const filtrosActivos = Object.values(filtros).filter(Boolean).length
  const i = dato?.indicadores
  const sinDatos = !i || i.registros === 0

  const datosDia = (dato?.porDia ?? []).map((d) => ({ ...d, etiqueta: fechaCorta(d.fecha) }))
  const datosCuadrilla = dato?.porCuadrilla ?? []
  const datosUbicacion = dato?.porUbicacion ?? []
  const datosActividad = dato?.porActividad ?? []
  const curva = useMemo(() => acumular(dato?.porDia ?? [], paso), [dato, paso])

  // El periodo que realmente se esta viendo: lo que diga el filtro, y si no lo
  // dice, del primer al ultimo dia con trabajo registrado.
  const periodo =
    datosDia.length === 0
      ? ''
      : `${formatoFecha(filtros.desde || datosDia[0].fecha)} a ${formatoFecha(
          filtros.hasta || datosDia[datosDia.length - 1].fecha,
        )}`

  /** Bajar de nivel desde la grafica: pulsar una torre filtra por esa torre. */
  const bajarNivel = (clave: string) => {
    if (!dato) return
    if (dato.nivelUbicacion === 'torre') cambiar({ torreId: clave, pisoId: '', zonaId: '' })
    else if (dato.nivelUbicacion === 'piso') cambiar({ pisoId: clave, zonaId: '' })
    else if (dato.nivelUbicacion === 'zona') cambiar({ zonaId: clave })
  }

  return (
    <div>
      <EncabezadoPagina
        antetitulo="Panel operativo"
        titulo="Resumen de la obra"
        meta={
          sinDatos ? undefined : (
            <>
              <span className="flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5 text-obra-400" />
                {periodo}
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-obra-400" />
                {formatoNumero(i.registros, 0)} registros en {formatoNumero(i.obras, 0)} obras
              </span>
              {cargando && (
                <span className="flex items-center gap-1.5 text-marca-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Actualizando
                </span>
              )}
            </>
          )
        }
      />

      <BarraFiltros activos={filtrosActivos} onLimpiar={() => setFiltros(filtrosVacios)}>
        <FiltroSeleccion
          etiqueta="Proyecto"
          value={filtros.proyectoId}
          onChange={(v) =>
            cambiar({ proyectoId: v, torreId: '', pisoId: '', zonaId: '', cuadrillaId: '' })
          }
        >
          <option value="">Todos</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo}
            </option>
          ))}
        </FiltroSeleccion>

        <FiltroSeleccion
          etiqueta="Torre"
          value={filtros.torreId}
          disabled={!filtros.proyectoId}
          onChange={(v) => cambiar({ torreId: v, pisoId: '', zonaId: '' })}
        >
          <option value="">Todas</option>
          {torres.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </FiltroSeleccion>

        <FiltroSeleccion
          etiqueta="Piso"
          value={filtros.pisoId}
          disabled={!filtros.torreId}
          onChange={(v) => cambiar({ pisoId: v, zonaId: '' })}
        >
          <option value="">Todos</option>
          {pisos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre || `Piso ${p.numero}`}
            </option>
          ))}
        </FiltroSeleccion>

        <FiltroSeleccion
          etiqueta="Zona"
          value={filtros.zonaId}
          disabled={!filtros.pisoId}
          onChange={(v) => cambiar({ zonaId: v })}
        >
          <option value="">Todas</option>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </FiltroSeleccion>

        <FiltroSeleccion
          etiqueta="Actividad"
          value={filtros.actividadId}
          onChange={(v) => cambiar({ actividadId: v })}
        >
          <option value="">Todas</option>
          {actividades.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </FiltroSeleccion>

        <FiltroSeleccion
          etiqueta="Cuadrilla"
          value={filtros.cuadrillaId}
          onChange={(v) => cambiar({ cuadrillaId: v })}
        >
          <option value="">Todas</option>
          {cuadrillas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </FiltroSeleccion>

        <FiltroSeleccion
          etiqueta="Trabajador"
          value={filtros.trabajadorId}
          onChange={(v) => cambiar({ trabajadorId: v })}
        >
          <option value="">Todos</option>
          {trabajadores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.apellido} {t.nombre}
            </option>
          ))}
        </FiltroSeleccion>

        <FiltroSeleccion
          etiqueta="Cargo"
          value={filtros.cargoId}
          onChange={(v) => cambiar({ cargoId: v })}
        >
          <option value="">Todos</option>
          {cargos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </FiltroSeleccion>

        <FiltroFecha
          etiqueta="Desde"
          value={filtros.desde}
          max={filtros.hasta || undefined}
          onChange={(v) => cambiar({ desde: v })}
        />
        <FiltroFecha
          etiqueta="Hasta"
          value={filtros.hasta}
          min={filtros.desde || undefined}
          onChange={(v) => cambiar({ hasta: v })}
        />
      </BarraFiltros>

      {cargando && !dato ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-obra-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando...
        </div>
      ) : sinDatos ? (
        <Tarjeta>
          <TarjetaCuerpo className="py-14 text-center">
            <p className="font-medium text-obra-900">Sin registros para estos filtros</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-obra-500">
              Amplia el rango de fechas o quita algun filtro.
            </p>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : (
        <>
          {/* Los cuatro indicadores que resumen el periodo filtrado */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              etiqueta="Produccion total"
              sobretitulo="Ejecutado en el periodo"
              valor={formatoNumero(i.m2Ejecutados)}
              unidad="m2"
              icono={Ruler}
              acento
              chip={`${formatoNumero(i.horasEfectivas, 0)} h efectivas`}
              tonoChip="marca"
              detalle={`receso ${formatoDuracion(i.minutosReceso)}`}
            />
            <Indicador
              etiqueta="Avance real"
              sobretitulo={`sobre ${formatoNumero(i.m2Totales)} m2 de obra`}
              valor={formatoPorcentaje(i.avance)}
              icono={Percent}
              progreso={i.avance ?? 0}
              chip={`${formatoNumero(dato.obrasTerminadas, 0)} de ${formatoNumero(i.obras, 0)} obras al 100%`}
              tonoChip={dato.obrasTerminadas === i.obras ? 'bueno' : 'neutro'}
              detalle={`faltan ${formatoNumero(i.m2Pendientes)} m2`}
            />
            <Indicador
              etiqueta="Cumplimiento"
              sobretitulo="Ejecutado contra la meta"
              valor={formatoPorcentaje(i.cumplimiento)}
              icono={Activity}
              progreso={i.cumplimiento ?? 0}
              chip={(i.cumplimiento ?? 0) >= 1 ? 'En meta' : 'Bajo meta'}
              tonoChip={(i.cumplimiento ?? 0) >= 1 ? 'bueno' : 'aviso'}
              detalle={`meta ${formatoNumero(i.m2Meta)} m2`}
            />
            <Indicador
              etiqueta="Rendimiento"
              sobretitulo="Por hora efectiva trabajada"
              valor={i.rendimiento === null ? '-' : formatoNumero(i.rendimiento)}
              unidad="m2/h"
              icono={Gauge}
              detalle={`${formatoNumero(i.horasEfectivas, 1)} h sobre ${formatoNumero(i.registros, 0)} jornadas`}
            />
          </div>

          <div className="space-y-4">
            {/* 1. Curva acumulada: lo ejecutado contra la meta, hasta la fecha */}
            <Grafica
              titulo="Evolucion de la produccion"
              descripcion="Acumulado de lo ejecutado frente al acumulado de la meta, a lo largo del periodo."
              nota="La meta sale de los m2 meta que lleva cada registro, no de un programa de obra aparte: mide contra lo que se propuso el dia que se trabajo."
              vacio={curva.length === 0}
              acciones={
                <>
                  <Leyenda
                    className="mb-0"
                    series={[
                      { etiqueta: 'Ejecutado', color: paleta.serie1 },
                      { etiqueta: 'Meta', color: paleta.serie2, forma: 'punteada' },
                    ]}
                  />
                  <Segmentado
                    valor={paso}
                    onCambio={setPaso}
                    opciones={[
                      { valor: 'dia', texto: 'Dia' },
                      { valor: 'semana', texto: 'Semana' },
                      { valor: 'mes', texto: 'Mes' },
                    ]}
                  />
                </>
              }
              columnas={['Periodo', 'Ejecutado m2', 'Acumulado m2', 'Meta acumulada m2', 'Diferencia']}
              filas={curva.map((c) => [
                c.etiqueta,
                formatoNumero(c.m2Ejecutados),
                formatoNumero(c.acumulado),
                formatoNumero(c.acumuladoMeta),
                `${c.acumulado >= c.acumuladoMeta ? '+' : ''}${formatoNumero(c.acumulado - c.acumuladoMeta)}`,
              ])}
            >
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={curva} margin={{ top: 8, right: 20, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="degradadoEjecutado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={paleta.serie1} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={paleta.serie1} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={paleta.rejilla} vertical={false} />
                  <XAxis dataKey="etiqueta" {...ejeComun} minTickGap={24} />
                  <YAxis {...ejeComun} width={60} />
                  <Tooltip
                    cursor={{ stroke: paleta.eje, strokeWidth: 1 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as (typeof curva)[number]
                      const dif = p.acumulado - p.acumuladoMeta
                      return (
                        <Globo
                          titulo={String(label)}
                          lineas={[
                            {
                              etiqueta: 'acumulado ejecutado',
                              valor: formatoNumero(p.acumulado),
                              color: paleta.serie1,
                            },
                            {
                              etiqueta: 'acumulado meta',
                              valor: formatoNumero(p.acumuladoMeta),
                              color: paleta.serie2,
                            },
                            {
                              etiqueta: dif >= 0 ? 'por encima de la meta' : 'por debajo de la meta',
                              valor: formatoNumero(Math.abs(dif)),
                            },
                            { etiqueta: 'en el periodo', valor: formatoNumero(p.m2Ejecutados) },
                          ]}
                        />
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="acumulado"
                    stroke="none"
                    fill="url(#degradadoEjecutado)"
                    isAnimationActive={false}
                  />
                  {/* La meta va punteada: se distingue del trazo real sin
                      depender del color, que es lo que pide la accesibilidad. */}
                  <Line
                    type="monotone"
                    dataKey="acumuladoMeta"
                    stroke={paleta.serie2}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="acumulado"
                    stroke={paleta.serie1}
                    strokeWidth={2}
                    strokeLinecap="round"
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: paleta.serie1,
                      stroke: paleta.superficie,
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Grafica>

            {/* 2. Produccion por dia, con el reparto por actividad */}
            <Grafica
              titulo="Produccion por dia"
              descripcion="m2 ejecutados en cada jornada. Solo aparecen los dias con trabajo registrado."
              nota="Las barras son el total del dia, sin repartir. El desglose por actividad esta arriba para el periodo completo, en el globo para cada dia, y dia por dia en la vista de Datos."
              vacio={datosDia.length === 0}
              columnas={[
                'Dia',
                ...datosActividad.map((a) => `${a.etiqueta} m2`),
                'Total m2',
                'Horas',
                'Rendimiento',
                'Registros',
              ]}
              filas={datosDia.map((d) => [
                formatoFecha(d.fecha),
                ...datosActividad.map((a) =>
                  d.porActividad[a.clave] ? formatoNumero(d.porActividad[a.clave]) : '-',
                ),
                formatoNumero(d.m2Ejecutados),
                formatoNumero(d.horasEfectivas, 1),
                d.rendimiento === null ? '-' : formatoNumero(d.rendimiento),
                String(d.registros),
              ])}
            >
              <Totales
                titulo={
                  periodo ? `Produccion por actividad · ${periodo}` : 'Produccion por actividad'
                }
                items={datosActividad.map((a) => ({
                  etiqueta: a.etiqueta,
                  valor: `${formatoNumero(a.m2Ejecutados)} m2`,
                  detalle: `${formatoPorcentaje(a.participacion)} · ${formatoNumero(a.obras, 0)} obras`,
                }))}
              />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={datosDia} margin={{ top: 8, right: 20, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={paleta.rejilla} vertical={false} />
                  <XAxis dataKey="etiqueta" {...ejeComun} minTickGap={20} />
                  <YAxis {...ejeComun} width={52} />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const dia = payload[0].payload as (typeof datosDia)[number]
                      return (
                        <Globo
                          titulo={String(label)}
                          lineas={[
                            {
                              etiqueta: 'm2 ejecutados',
                              valor: formatoNumero(dia.m2Ejecutados),
                              color: paleta.serie1,
                            },
                            // El desglose del dia, en el orden de la fila de
                            // totales de arriba.
                            ...datosActividad
                              .filter((a) => dia.porActividad[a.clave])
                              .map((a) => ({
                                etiqueta: a.etiqueta,
                                valor: formatoNumero(dia.porActividad[a.clave]),
                              })),
                          ]}
                        />
                      )
                    }}
                  />
                  <Bar
                    dataKey="m2Ejecutados"
                    fill={paleta.serie1}
                    maxBarSize={GROSOR_BARRA}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Grafica>

            <div className="grid gap-4 xl:grid-cols-2">
              {/* 3. Rendimiento por dia */}
              <Grafica
                titulo="Rendimiento por dia"
                descripcion="m2 por hora efectiva de cada jornada."
                nota="Va aparte y no encima de la produccion a proposito: dos escalas distintas en un mismo eje inventan relaciones que los datos no tienen."
                vacio={datosDia.length === 0}
                acciones={
                  <Leyenda
                    className="mb-0"
                    series={[
                      { etiqueta: 'Del dia', color: paleta.serie1 },
                      {
                        etiqueta: `Promedio ${formatoNumero(dato.rendimientoPromedio)}`,
                        color: paleta.serie2,
                      },
                    ]}
                  />
                }
                columnas={['Dia', 'Rendimiento m2/h', 'm2 ejecutados', 'Horas']}
                filas={datosDia.map((d) => [
                  formatoFecha(d.fecha),
                  d.rendimiento === null ? '-' : formatoNumero(d.rendimiento),
                  formatoNumero(d.m2Ejecutados),
                  formatoNumero(d.horasEfectivas, 1),
                ])}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={datosDia} margin={{ top: 8, right: 20, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={paleta.rejilla} vertical={false} />
                    <XAxis dataKey="etiqueta" {...ejeComun} minTickGap={20} />
                    <YAxis
                      {...ejeComun}
                      width={52}
                      allowDecimals={false}
                      domain={[0, (max: number) => Math.ceil(max)]}
                    />
                    <Tooltip
                      cursor={{ stroke: paleta.eje, strokeWidth: 1 }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <Globo
                            titulo={String(label)}
                            lineas={[
                              {
                                etiqueta: 'm2 por hora',
                                valor: formatoNumero(Number(payload[0].value)),
                                color: paleta.serie1,
                              },
                            ]}
                          />
                        ) : null
                      }
                    />
                    {dato.rendimientoPromedio !== null && (
                      <ReferenceLine
                        y={dato.rendimientoPromedio}
                        stroke={paleta.serie2}
                        strokeWidth={2}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="rendimiento"
                      stroke={paleta.serie1}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: paleta.serie1,
                        stroke: paleta.superficie,
                        strokeWidth: 2,
                      }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Grafica>

              {/* 4. Rendimiento por cuadrilla */}
              <Grafica
                titulo="Rendimiento por cuadrilla"
                descripcion="m2 por hora efectiva de cada cuadrilla."
                nota="El rendimiento de cada cuadrilla sale de dividir todos sus m2 entre todas sus horas, no de promediar los rendimientos de sus dias."
                vacio={datosCuadrilla.length === 0}
                acciones={
                  <Leyenda
                    className="mb-0"
                    series={[
                      { etiqueta: 'Cuadrilla', color: paleta.serie1, forma: 'barra' },
                      {
                        etiqueta: `Promedio ${formatoNumero(dato.rendimientoPromedio)}`,
                        color: paleta.serie2,
                      },
                    ]}
                  />
                }
                columnas={['Cuadrilla', 'Rendimiento m2/h', 'm2 ejecutados', 'Horas', 'Cumplimiento']}
                filas={datosCuadrilla.map((c) => [
                  c.etiqueta,
                  c.rendimiento === null ? '-' : formatoNumero(c.rendimiento),
                  formatoNumero(c.m2Ejecutados),
                  formatoNumero(c.horasEfectivas, 1),
                  formatoPorcentaje(c.cumplimiento),
                ])}
              >
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, datosCuadrilla.length * 44)}
                >
                  <BarChart
                    data={datosCuadrilla}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid stroke={paleta.rejilla} horizontal={false} />
                    <XAxis
                      type="number"
                      {...ejeComun}
                      allowDecimals={false}
                      domain={[0, (max: number) => Math.ceil(max)]}
                    />
                    <YAxis type="category" dataKey="etiqueta" {...ejeComun} width={96} />
                    <Tooltip
                      cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <Globo
                            titulo={String(label)}
                            lineas={[
                              {
                                etiqueta: 'm2 por hora',
                                valor: formatoNumero(Number(payload[0].value)),
                                color: paleta.serie1,
                              },
                            ]}
                          />
                        ) : null
                      }
                    />
                    {dato.rendimientoPromedio !== null && (
                      <ReferenceLine
                        x={dato.rendimientoPromedio}
                        stroke={paleta.serie2}
                        strokeWidth={2}
                      />
                    )}
                    <Bar
                      dataKey="rendimiento"
                      fill={paleta.serie1}
                      maxBarSize={GROSOR_BARRA}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Grafica>
            </div>

            {/* 5. Avance por ubicacion */}
            <Grafica
              titulo={`Avance por ${NOMBRE_NIVEL[dato.nivelUbicacion]}`}
              descripcion="Lo ejecutado sobre el area total. Pulsa una fila para bajar un nivel."
              nota="El area de cada obra cuenta una sola vez aunque se haya trabajado varios dias."
              vacio={datosUbicacion.length === 0}
              columnas={['Ubicacion', 'Ejecutado m2', 'Total m2', 'Pendiente m2', 'Avance']}
              filas={datosUbicacion.map((u) => [
                u.etiqueta,
                formatoNumero(u.m2Ejecutados),
                formatoNumero(u.m2Totales),
                formatoNumero(u.m2Pendientes),
                formatoPorcentaje(u.avance),
              ])}
            >
              <ul className="divide-y divide-obra-100">
                {datosUbicacion.map((u, indice) => {
                  const porcentaje = Math.min(100, (u.avance ?? 0) * 100)
                  const completo = porcentaje >= 99.99
                  const puedeBajar = dato.nivelUbicacion !== 'frente'
                  return (
                    <li key={u.clave}>
                      <button
                        onClick={() => puedeBajar && bajarNivel(u.clave)}
                        disabled={!puedeBajar}
                        className={`w-full rounded-lg px-2 py-3 text-left ${
                          puedeBajar ? 'hover:bg-obra-50' : 'cursor-default'
                        }`}
                        title={puedeBajar ? `Ver el detalle de ${u.etiqueta}` : undefined}
                      >
                        <div className="flex items-baseline gap-3">
                          <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-obra-300">
                            {String(indice + 1).padStart(2, '0')}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-obra-900">
                              {u.etiqueta}
                            </span>
                            <span className="block text-xs tabular-nums text-obra-500">
                              {formatoNumero(u.m2Ejecutados)} de {formatoNumero(u.m2Totales)} m2
                              {u.m2Pendientes > 0 &&
                                `, faltan ${formatoNumero(u.m2Pendientes)}`}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-semibold tabular-nums text-obra-900">
                              {formatoPorcentaje(u.avance)}
                            </span>
                            <span
                              className={`block text-[11px] ${
                                completo ? 'text-emerald-600' : 'text-obra-400'
                              }`}
                            >
                              {completo ? 'Completado' : `${formatoNumero(u.obras, 0)} obras`}
                            </span>
                          </span>
                        </div>
                        <div className="ml-9 mt-2 h-2 overflow-hidden rounded-full bg-obra-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${porcentaje}%`,
                              backgroundColor: completo ? '#059669' : paleta.serie1,
                            }}
                          />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Grafica>
          </div>

          <p className="mt-4 text-xs text-obra-400">
            Los filtros mandan sobre todo el panel: los indicadores de arriba y las cinco graficas
            se recalculan sobre el mismo subconjunto.
          </p>
        </>
      )}
    </div>
  )
}
