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

/**
 * Un desplegable con su etiqueta dentro de la pastilla.
 *
 * El <select> ocupa la pastilla ENTERA, con la etiqueta encima y sin capturar
 * el clic. Antes la pastilla era un <label> y el desplegable solo cubria el
 * texto del valor: pulsar en el borde, en la etiqueta o en la flecha enfocaba
 * el control pero no lo abria, asi que habia que acertarle justo a la palabra
 * "Todos". Ahora vale cualquier punto de la pastilla.
 */
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
    <div
      className={cn(
        'relative flex min-w-0 rounded-lg border transition-colors',
        disabled
          ? 'border-obra-100 bg-obra-50'
          : value
            ? 'border-marca-200 bg-marca-50 hover:border-marca-300'
            : 'border-obra-200 bg-white hover:border-obra-300',
      )}
    >
      {/* pointer-events-none: la etiqueta se ve, pero el clic pasa al select */}
      <span
        className={cn(
          'pointer-events-none absolute left-3 top-1 text-[10px] font-medium uppercase tracking-wide',
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
          'w-full min-w-0 appearance-none truncate rounded-lg bg-transparent pb-1.5 pl-3 pr-7 pt-5 text-sm font-medium',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-300',
          disabled ? 'cursor-not-allowed text-obra-400' : 'cursor-pointer text-obra-900',
        )}
      >
        {children}
      </select>

      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
          disabled ? 'text-obra-300' : 'text-obra-400',
        )}
      />
    </div>
  )
}

/**
 * Un campo de fecha con su etiqueta dentro de la pastilla.
 *
 * Mismo criterio que el desplegable: el input cubre toda la pastilla, y al
 * pulsarla se abre el calendario en vez de dejar el cursor en el dia.
 */
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
    <div
      className={cn(
        'relative flex min-w-0 rounded-lg border transition-colors',
        value
          ? 'border-marca-200 bg-marca-50 hover:border-marca-300'
          : 'border-obra-200 bg-white hover:border-obra-300',
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute left-3 top-1 text-[10px] font-medium uppercase tracking-wide',
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
        // showPicker abre el calendario desde cualquier punto del campo. No
        // esta en todos los navegadores, y donde no esta el campo sigue
        // funcionando como siempre.
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="w-full min-w-0 cursor-pointer rounded-lg bg-transparent pb-1.5 pl-3 pr-3 pt-5 text-sm font-medium text-obra-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-300"
      />
    </div>
  )
}
