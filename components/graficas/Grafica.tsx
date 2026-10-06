'use client'

import { useState } from 'react'
import { Table2, LineChart as IconoGrafica } from 'lucide-react'
import { paleta } from './paleta'

/** Marco comun de las graficas: titulo, nota y vista de tabla con los datos. */
export function Grafica({
  titulo,
  descripcion,
  nota,
  vacio,
  columnas,
  filas,
  acciones,
  children,
  className,
}: {
  titulo: string
  descripcion?: string
  nota?: string
  /** Mensaje cuando no hay datos. */
  vacio?: boolean
  /** Encabezados de la vista de tabla. */
  columnas: string[]
  /** Filas de la vista de tabla, ya formateadas. */
  filas: string[][]
  /** Controles de la grafica (leyenda, agrupacion...). */
  acciones?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [verTabla, setVerTabla] = useState(false)

  return (
    <section
      className={`tarjeta p-4 sm:p-5 ${className ?? ''}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-obra-900">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-xs text-obra-500">{descripcion}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!verTabla && acciones}
          <button
            onClick={() => setVerTabla((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-obra-50 px-2.5 py-1.5 text-xs font-medium text-obra-600 hover:bg-obra-100 hover:text-obra-900"
            title={verTabla ? 'Ver la grafica' : 'Ver los datos en tabla'}
          >
            {verTabla ? (
              <IconoGrafica className="h-3.5 w-3.5" />
            ) : (
              <Table2 className="h-3.5 w-3.5" />
            )}
            {verTabla ? 'Grafica' : 'Datos'}
          </button>
        </div>
      </header>

      {vacio ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-obra-200 text-sm text-obra-400">
          Sin datos para los filtros elegidos
        </div>
      ) : verTabla ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-obra-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-obra-50">
              <tr>
                {columnas.map((c, i) => (
                  <th
                    key={c}
                    className={`px-3 py-2 text-xs font-medium text-obra-500 ${
                      i === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-obra-100">
              {filas.map((fila, indice) => (
                <tr key={indice}>
                  {fila.map((celda, i) => (
                    <td
                      key={i}
                      className={`px-3 py-2 ${
                        i === 0 ? 'text-obra-700' : 'text-right tabular-nums text-obra-900'
                      }`}
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}

      {nota && !verTabla && <p className="mt-3 text-xs text-obra-400">{nota}</p>}
    </section>
  )
}

/** Globo que sigue al puntero. */
export function Globo({
  titulo,
  lineas,
}: {
  titulo: string
  lineas: Array<{ etiqueta: string; valor: string; color?: string }>
}) {
  return (
    <div className="rounded-lg border border-obra-100 bg-white px-3 py-2 shadow-flotante">
      <p className="text-xs text-obra-500">{titulo}</p>
      <div className="mt-1.5 space-y-1">
        {lineas.map((l) => (
          <div key={l.etiqueta} className="flex items-baseline gap-2">
            {l.color && (
              <span
                className="mt-1 h-0.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: l.color }}
              />
            )}
            <span className="text-sm font-semibold tabular-nums text-obra-900">{l.valor}</span>
            <span className="text-xs text-obra-500">{l.etiqueta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Leyenda de la grafica, encima del dibujo. */
export function Leyenda({
  series,
  className,
}: {
  series: Array<{ etiqueta: string; color: string; forma?: 'linea' | 'barra' | 'punteada' }>
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className ?? 'mb-3'}`}>
      {series.map((s) => (
        <span key={s.etiqueta} className="flex items-center gap-1.5 text-xs text-obra-600">
          {s.forma === 'punteada' ? (
            // La meta tambien va punteada en la leyenda.
            <span
              className="h-0 w-4 border-t-2 border-dashed"
              style={{ borderColor: s.color }}
            />
          ) : (
            <span
              className={s.forma === 'barra' ? 'h-2.5 w-2.5 rounded-sm' : 'h-0.5 w-4 rounded-full'}
              style={{ backgroundColor: s.color }}
            />
          )}
          {s.etiqueta}
        </span>
      ))}
    </div>
  )
}

/** Fila de totales encima del dibujo (texto, sin colores). */
export function Totales({
  titulo,
  items,
}: {
  titulo?: string
  items: Array<{ etiqueta: string; valor: string; detalle?: string }>
}) {
  if (items.length === 0) return null

  return (
    <div className="mb-4 rounded-lg bg-obra-50 px-3 py-2.5">
      {titulo && (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-obra-500">
          {titulo}
        </p>
      )}
      <div className="flex flex-wrap gap-x-7 gap-y-2">
        {items.map((i) => (
          <div key={i.etiqueta}>
            <p className="text-xs text-obra-600">{i.etiqueta}</p>
            <p className="text-sm font-semibold tabular-nums text-obra-900">
              {i.valor}
              {i.detalle && (
                <span className="ml-1.5 text-xs font-normal tabular-nums text-obra-400">
                  {i.detalle}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Control segmentado: una opcion entre pocas, todas visibles. */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: Array<{ valor: T; texto: string }>
  valor: T
  onCambio: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg bg-obra-100/70 p-0.5">
      {opciones.map((o) => (
        <button
          key={o.valor}
          onClick={() => onCambio(o.valor)}
          aria-pressed={o.valor === valor}
          className={`rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors ${
            o.valor === valor
              ? 'bg-white text-marca-700 shadow-sm'
              : 'text-obra-500 hover:text-obra-800'
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/** Ejes y rejilla comunes. */
export const ejeComun = {
  tick: { fill: paleta.ticks, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: paleta.eje },
} as const
