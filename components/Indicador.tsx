import { cn } from '@/lib/utils'

/** Tono del chip que acompaña al numero. Nunca es el unico portador del dato. */
export type TonoChip = 'neutro' | 'bueno' | 'aviso' | 'marca'

const chips: Record<TonoChip, string> = {
  neutro: 'bg-obra-100 text-obra-600',
  bueno: 'bg-emerald-50 text-emerald-700',
  aviso: 'bg-acento-100 text-acento-800',
  marca: 'bg-marca-50 text-marca-700',
}

/**
 * Tarjeta de indicador.
 *
 * El numero es lo unico grande de la tarjeta; la etiqueta, la unidad y el pie
 * van pequeños a proposito, porque lo que se viene a leer es la cifra.
 *
 * La barra de progreso es opcional y solo tiene sentido cuando el valor es una
 * fraccion de algo, como el avance: ponerla debajo de un rendimiento en m2 por
 * hora no significaria nada, porque no hay un 100% contra el cual medirlo.
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
  /** Segunda linea junto a la etiqueta: contra que se compara el numero. */
  sobretitulo?: string
  valor: string
  unidad?: string
  detalle?: string
  /** Texto corto destacado en el pie: una variacion, un estado. */
  chip?: string
  tonoChip?: TonoChip
  /** Fraccion de 0 a 1. Dibuja la barra bajo el numero. */
  progreso?: number
  icono?: React.ComponentType<{ className?: string }>
  /** Marca la tarjeta principal del grupo, solo en el icono. */
  acento?: boolean
}) {
  const relleno = progreso === undefined ? 0 : Math.max(0, Math.min(1, progreso)) * 100

  return (
    // Columna con el pie empujado abajo: en una fila de tarjetas, una sin barra
    // de progreso dejaba su pie a media altura y la fila se veia desalineada.
    <div className="flex h-full flex-col rounded-xl border border-obra-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-obra-500">
            {etiqueta}
          </p>
          {sobretitulo && <p className="mt-0.5 text-xs text-obra-400">{sobretitulo}</p>}
        </div>
        {Icono && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              acento ? 'bg-marca-50 text-marca-600' : 'bg-obra-50 text-obra-400',
            )}
          >
            <Icono className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-obra-900">
          {valor}
        </span>
        {unidad && <span className="text-sm font-medium text-obra-400">{unidad}</span>}
      </p>

      <div className="mt-auto">
        {progreso !== undefined && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-obra-100" aria-hidden>
            <div
              className={cn(
                'h-full rounded-full',
                relleno >= 100 ? 'bg-emerald-500' : 'bg-marca-600',
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
