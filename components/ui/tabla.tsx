'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Columna<T> = {
  clave: string
  titulo: string
  /** Contenido de la celda. */
  render: (fila: T) => React.ReactNode
  /** Ocultar esta columna en pantallas pequenas. */
  soloEscritorio?: boolean
  alineacion?: 'izquierda' | 'derecha'
}

/**
 * Tabla en escritorio y tarjetas apiladas en movil, que es la unica forma de
 * que una lista con muchas columnas siga siendo legible en un telefono en obra.
 */
export function Tabla<T extends { id: number }>({
  columnas,
  filas,
  cargando,
  vacio,
  acciones,
  onFilaClick,
}: {
  columnas: Columna<T>[]
  filas: T[]
  cargando?: boolean
  vacio: React.ReactNode
  acciones?: (fila: T) => React.ReactNode
  onFilaClick?: (fila: T) => void
}) {
  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-obra-200 bg-white py-16 text-sm text-obra-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    )
  }

  if (filas.length === 0) return <>{vacio}</>

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-hidden rounded-xl border border-obra-200 bg-white shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-obra-100 bg-obra-50/60">
              <tr>
                {columnas.map((c) => (
                  <th
                    key={c.clave}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-obra-500',
                      c.alineacion === 'derecha' && 'text-right',
                    )}
                  >
                    {c.titulo}
                  </th>
                ))}
                {acciones && <th className="w-px px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-obra-100">
              {filas.map((fila) => (
                <tr
                  key={fila.id}
                  onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
                  className={cn('hover:bg-obra-50/60', onFilaClick && 'cursor-pointer')}
                >
                  {columnas.map((c) => (
                    <td
                      key={c.clave}
                      className={cn(
                        'px-4 py-3 text-obra-700',
                        c.alineacion === 'derecha' && 'text-right tabular-nums',
                      )}
                    >
                      {c.render(fila)}
                    </td>
                  ))}
                  {acciones && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">{acciones(fila)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movil */}
      <div className="space-y-3 sm:hidden">
        {filas.map((fila) => (
          <div
            key={fila.id}
            onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
            className="rounded-xl border border-obra-200 bg-white p-4 shadow-sm"
          >
            <div className="space-y-2">
              {columnas
                .filter((c) => !c.soloEscritorio)
                .map((c, indice) => (
                  <div key={c.clave} className={cn(indice === 0 && 'pb-1')}>
                    {indice === 0 ? (
                      <div className="font-medium text-obra-900">{c.render(fila)}</div>
                    ) : (
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-obra-500">{c.titulo}</span>
                        <span className="text-right text-obra-700">{c.render(fila)}</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
            {acciones && (
              <div
                className="mt-3 flex justify-end gap-1 border-t border-obra-100 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                {acciones(fila)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
