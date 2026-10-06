import { cn } from '@/lib/utils'

/** Color del chip que acompana al numero. */
export type TonoChip = 'neutro' | 'bueno' | 'aviso' | 'marca'

const chips: Record<TonoChip, string> = {
  neutro: 'bg-obra-100 text-obra-600',
  bueno: 'bg-menta-50 text-menta-700',
  aviso: 'bg-acento-50 text-acento-700',
  marca: 'bg-marca-50 text-marca-700',
}

/**
 * Tarjeta de indicador: el numero grande, lo demas pequeno.
 * La barra de progreso solo se usa para fracciones (como el avance).
 */
export function Indicador({
  etiqueta,
  sobretitulo,
  valor,
  unidad,
  detalle,
  chip,
  tonoChip = 'neutro',
  progreso,
  icono: Icono,
  acento,
}: {
  etiqueta: string
  /** Linea bajo la etiqueta: contra que se compara. */
  sobretitulo?: string
  valor: string
  unidad?: string
  detalle?: string
  /** Texto corto destacado en el pie. */
  chip?: string
  tonoChip?: TonoChip
  /** Fraccion de 0 a 1 para la barra de progreso. */
  progreso?: number
  icono?: React.ComponentType<{ className?: string }>
  /** Resalta el icono de la tarjeta principal. */
  acento?: boolean
}) {
  const relleno = progreso === undefined ? 0 : Math.max(0, Math.min(1, progreso)) * 100

  return (
    // Columna con el pie abajo, para alinear tarjetas con y sin barra.
    <div className="tarjeta flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hyphens-auto break-words text-[13px] font-semibold text-obra-800 sm:text-sm">
            {etiqueta}
          </p>
          {sobretitulo && <p className="mt-0.5 text-xs text-obra-400">{sobretitulo}</p>}
        </div>
        {Icono && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9',
              acento ? 'bg-marca-600 text-white' : 'bg-marca-50 text-marca-600',
            )}
          >
            <Icono className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-obra-900 sm:text-3xl">
          {valor}
        </span>
        {unidad && <span className="text-sm font-medium text-obra-400">{unidad}</span>}
      </p>

      <div className="mt-auto">
        {progreso !== undefined && (
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-obra-100" aria-hidden>
            <div
              className={cn(
                'h-full rounded-full',
                relleno >= 100 ? 'bg-menta-400' : 'bg-marca-500',
              )}
              style={{ width: `${relleno}%` }}
            />
          </div>
        )}

        {(detalle || chip) && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {chip && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  chips[tonoChip],
                )}
              >
                {chip}
              </span>
            )}
            {detalle && <span className="text-xs text-obra-500">{detalle}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
