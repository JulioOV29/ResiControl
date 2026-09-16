'use client'

import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barra de filtros en pastillas.
 *
 * Cada filtro lleva su etiqueta encima del valor, dentro de la misma pastilla.
 * Es mas alto que un <select> pelado, pero resuelve el problema que tenia la
 * barra anterior: una fila de desplegables donde el valor elegido no decia de
 * que era, asi que habia que abrirlos para acordarse.
 */
export function BarraFiltros({
  children,
  activos,
  onLimpiar,
  className,
}: {
  children: React.ReactNode
  /** Cuantos filtros hay puestos. Con cero no se ofrece limpiar. */
  activos: number
  onLimpiar: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-5 rounded-xl border border-obra-200 bg-white p-3 shadow-sm sm:p-4',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-obra-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activos > 0 && (
            <span className="rounded-full bg-marca-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-marca-700">
              {activos}
            </span>
          )}
        </span>

        {activos > 0 && (
          <button
            onClick={onLimpiar}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-obra-500 hover:bg-obra-50 hover:text-obra-800"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/*
        Rejilla y no una fila que se desborda: con diez filtros, el flex-wrap
        dejaba el ultimo solo en una segunda linea y de anchos distintos. Asi
        las pastillas caen en columnas parejas y el bloque se lee como una
        tabla de controles.
      */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </div>
  )
}

/** Un desplegable con su etiqueta dentro de la pastilla. */
export function FiltroSeleccion({
  etiqueta,
  value,
  onChange,
  disabled,
  children,
}: {
  etiqueta: string
  value: string
  onChange: (valor: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        'group relative flex min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors',
        disabled
          ? 'border-obra-100 bg-obra-50'
          : value
            ? 'border-marca-200 bg-marca-50 hover:border-marca-300'
            : 'border-obra-200 bg-white hover:border-obra-300',
      )}
    >
      <span className="min-w-0">
        <span
          className={cn(
            'block text-[10px] font-medium uppercase tracking-wide',
            value ? 'text-marca-700' : 'text-obra-400',
          )}
        >
          {etiqueta}
        </span>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'block w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-sm font-medium',
            'focus:outline-none focus-visible:underline',
            disabled ? 'text-obra-400' : 'text-obra-900',
          )}
        >
          {children}
        </select>
      </span>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-2.5 h-3.5 w-3.5',
          disabled ? 'text-obra-300' : 'text-obra-400',
        )}
      />
    </label>
  )
}

/** Un campo de fecha con su etiqueta dentro de la pastilla. */
export function FiltroFecha({
  etiqueta,
  value,
  onChange,
  min,
  max,
}: {
  etiqueta: string
  value: string
  onChange: (valor: string) => void
  min?: string
  max?: string
}) {
  return (
    <label
      className={cn(
        'flex min-w-0 items-center rounded-lg border px-3 py-1.5 transition-colors',
        value
          ? 'border-marca-200 bg-marca-50 hover:border-marca-300'
          : 'border-obra-200 bg-white hover:border-obra-300',
      )}
    >
      <span className="min-w-0">
        <span
          className={cn(
            'block text-[10px] font-medium uppercase tracking-wide',
            value ? 'text-marca-700' : 'text-obra-400',
          )}
        >
          {etiqueta}
        </span>
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full cursor-pointer bg-transparent text-sm font-medium text-obra-900 focus:outline-none"
        />
      </span>
    </label>
  )
}
