'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatoNumero } from '@/lib/utils'

/**
 * Calendario de registros: el mes como cuadricula compacta, con un solo color
 * para los dias que tienen registros.
 *
 * Responde de un vistazo la pregunta que una grafica de barras no responde
 * bien: que dias se trabajo y cuales quedaron en blanco. Los huecos son tan
 * informativos como los picos, y en una barra un dia sin trabajo simplemente no
 * existe.
 *
 * Un solo color a proposito: aqui lo que importa es si hubo o no hubo trabajo.
 * Cuanto se hizo cada dia asoma en el globo al pasar el cursor, y al pulsar un
 * dia se abre su informe completo en la mitad derecha de la tarjeta.
 *
 * Se alimenta de los mismos dias que ya calcula el panel, asi que no le pide
 * nada nuevo a la base.
 */

type Dia = {
  fecha: string
  m2Ejecutados: number
  m2Meta: number
  registros: number
  horasEfectivas: number
}

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Las fechas se manejan en UTC, igual que en el resto del sistema. */
const clave = (anio: number, mes: number, dia: number) =>
  `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

export function CalendarioRegistros({
  dias,
  seleccionada,
  onSeleccionar,
}: {
  dias: Dia[]
  /** El dia abierto en el informe de al lado. */
  seleccionada: string | null
  onSeleccionar: (fecha: string) => void
}) {
  const porFecha = useMemo(() => new Map(dias.map((d) => [d.fecha, d])), [dias])

  // El mes que se abre primero es el del ultimo dia con trabajo: es donde esta
  // mirando el residente, no el mes corriente del calendario.
  const ultimo = dias.length ? dias[dias.length - 1].fecha : null
  const inicial = ultimo ? ultimo.slice(0, 7) : new Date().toISOString().slice(0, 7)
  const [mesVisible, setMesVisible] = useState(inicial)

  /** El dia sobre el que esta el cursor, con su posicion para el globo. */
  const [encima, setEncima] = useState<{ dato: Dia; x: number; y: number } | null>(null)

  const [anio, mes] = mesVisible.split('-').map(Number)
  const mesIndice = mes - 1

  const moverMes = (paso: number) => {
    const d = new Date(Date.UTC(anio, mesIndice + paso, 1))
    setMesVisible(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    setEncima(null)
  }

  // Lunes primero: getUTCDay da 0 para domingo.
  const primerDia = new Date(Date.UTC(anio, mesIndice, 1)).getUTCDay()
  const huecoInicial = (primerDia + 6) % 7
  const totalDias = new Date(Date.UTC(anio, mesIndice + 1, 0)).getUTCDate()

  const celdas: Array<{ dia: number; fecha: string; dato?: Dia } | null> = [
    ...Array.from({ length: huecoInicial }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => {
      const fecha = clave(anio, mesIndice, i + 1)
      return { dia: i + 1, fecha, dato: porFecha.get(fecha) }
    }),
  ]

  const delMes = celdas.filter((c) => c?.dato).map((c) => c!.dato!)
  const m2DelMes = delMes.reduce((suma, d) => suma + d.m2Ejecutados, 0)

  /** Guarda el dia y donde dibujar el globo, en coordenadas de la cuadricula. */
  const mostrar = (dato: Dia, elemento: HTMLElement) =>
    setEncima({
      dato,
      x: elemento.offsetLeft + elemento.offsetWidth / 2,
      y: elemento.offsetTop,
    })

  return (
    <div className="mx-auto max-w-sm">
      {/* Mes y navegacion */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          onClick={() => moverMes(-1)}
          className="rounded-md border border-obra-200 p-1 text-obra-500 hover:bg-obra-50 hover:text-obra-800"
          title="Mes anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <p className="text-sm font-medium capitalize text-obra-900">
          {MESES[mesIndice]} {anio}
        </p>

        <button
          onClick={() => moverMes(1)}
          className="rounded-md border border-obra-200 p-1 text-obra-500 hover:bg-obra-50 hover:text-obra-800"
          title="Mes siguiente"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-obra-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* relative: el globo se posiciona dentro de esta cuadricula */}
      <div className="relative mt-1 grid grid-cols-7 gap-1" onMouseLeave={() => setEncima(null)}>
        {celdas.map((celda, i) => {
          if (!celda) return <div key={`hueco-${i}`} className="h-8" />

          const dato = celda.dato
          const activo = encima?.dato.fecha === celda.fecha
          const abierta = seleccionada === celda.fecha

          return (
            <div
              key={celda.fecha}
              // El foco por teclado abre el mismo globo que el cursor, y en
              // pantalla tactil lo abre el toque.
              tabIndex={dato ? 0 : -1}
              onMouseEnter={(e) => dato && mostrar(dato, e.currentTarget)}
              onFocus={(e) => dato && mostrar(dato, e.currentTarget)}
              onBlur={() => setEncima(null)}
              // El clic abre el informe del dia en la mitad derecha; el cursor
              // por encima solo asoma el resumen, sin cambiar lo que se ve.
              onClick={() => dato && onSeleccionar(celda.fecha)}
              onKeyDown={(e) => {
                if (dato && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onSeleccionar(celda.fecha)
                }
              }}
              className={`flex h-8 items-center justify-center rounded text-xs font-semibold tabular-nums outline-none transition-colors ${
                dato
                  ? `cursor-pointer bg-marca-600 text-white hover:bg-marca-700 ${
                      abierta ? 'ring-2 ring-marca-900 ring-offset-1' : activo ? 'ring-2 ring-marca-800' : ''
                    }`
                  : 'bg-obra-50 text-obra-300'
              }`}
            >
              {celda.dia}
            </div>
          )
        })}

        {encima && (
          <div
            className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 -translate-y-full rounded-lg border border-obra-200 bg-white p-2 text-left shadow-lg"
            style={{ left: encima.x, top: encima.y - 6 }}
          >
            <p className="text-xs font-semibold text-obra-900">
              {encima.dato.fecha.split('-').reverse().join('/')}
            </p>
            <dl className="mt-1 space-y-0.5 text-[11px] text-obra-600">
              <div className="flex justify-between gap-2">
                <dt>Ejecutado</dt>
                <dd className="tabular-nums text-obra-900">
                  {formatoNumero(encima.dato.m2Ejecutados)} m2
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Meta</dt>
                <dd className="tabular-nums">
                  {encima.dato.m2Meta > 0 ? `${formatoNumero(encima.dato.m2Meta)} m2` : 'sin meta'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Horas</dt>
                <dd className="tabular-nums">{formatoNumero(encima.dato.horasEfectivas, 1)} h</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Jornadas</dt>
                <dd className="tabular-nums">{encima.dato.registros}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Resumen del mes y leyenda */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-obra-500">
        <span className="tabular-nums">
          {delMes.length} de {totalDias} dias · {formatoNumero(m2DelMes)} m2
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-marca-600" />
          con registros
          <span className="ml-1 h-2.5 w-2.5 rounded bg-obra-50 ring-1 ring-inset ring-obra-200" />
          sin registros
        </span>
      </div>
    </div>
  )
}
