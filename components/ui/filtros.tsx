'use client'

import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Barra de filtros: cada filtro es una pastilla con su etiqueta encima del valor. */
export function BarraFiltros({
  children,
  activos,
  onLimpiar,
}: {
  children: React.ReactNode
  /** Filtros activos. Con cero no se muestra Limpiar. */
  activos: number
  onLimpiar: () => void
}) {
  return (
    <div className="tarjeta mb-5 p-3 sm:p-4">
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

      {/* Rejilla para que las pastillas queden en columnas parejas. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </div>
  )
}

/**
 * Desplegable dentro de una pastilla. El <select> cubre toda la pastilla,
 * asi cualquier clic lo abre.
 */
export function FiltroSeleccion({
  etiqueta,
  value,
  onChange,
  children,
}: {
  etiqueta: string
  value: string
  onChange: (valor: string) => void
  children: React.ReactNode
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
      {/* La etiqueta deja pasar el clic al select. */}
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
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg bg-transparent pb-1.5 pl-3 pr-7 pt-5 text-sm font-medium text-obra-900',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-300',
        )}
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-obra-400" />
    </div>
  )
}

/** Campo de fecha dentro de una pastilla; un clic abre el calendario. */
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
        // showPicker abre el calendario (si el navegador lo soporta).
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="w-full min-w-0 cursor-pointer rounded-lg bg-transparent pb-1.5 pl-3 pr-3 pt-5 text-sm font-medium text-obra-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-300"
      />
    </div>
  )
}
