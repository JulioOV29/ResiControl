'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Columna<T> = {
  clave: string
  titulo: string
  /** Contenido de la celda. */
  render: (fila: T) => React.ReactNode
  /** Ocultar en pantallas pequenas. */
  soloEscritorio?: boolean
  alineacion?: 'izquierda' | 'derecha'
}

/**
 * Tabla en pantallas grandes (desde 1280 px) y tarjetas en celular, tablet y
 * portatil pequeno (desde tablet, dos tarjetas por fila). Si la tabla no cabe, se desplaza de lado.
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
      <div className="tarjeta flex items-center justify-center gap-2 py-16 text-sm text-obra-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    )
  }

  if (filas.length === 0) return <>{vacio}</>

  return (
    <>
      {/* Escritorio */}
      <div className="tarjeta hidden overflow-hidden xl:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-obra-50/80">
              <tr>
                {columnas.map((c) => (
                  <th
                    key={c.clave}
                    className={cn(
                      'px-4 py-2.5 text-left text-xs font-medium text-obra-500',
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
                  className={cn('transition-colors hover:bg-marca-50/40', onFilaClick && 'cursor-pointer')}
                >
                  {columnas.map((c) => (
                    <td
                      key={c.clave}
                      className={cn(
                        'px-4 py-3.5 text-obra-700',
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

      {/* Celular y tablet */}
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {filas.map((fila) => (
          <div
            key={fila.id}
            onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
            className={cn(
              'tarjeta flex flex-col p-4',
              onFilaClick && 'cursor-pointer transition-colors hover:border-marca-200',
            )}
          >
            <div className={cn('space-y-2', acciones && 'mb-3')}>
              {columnas
                .filter((c) => !c.soloEscritorio)
                .map((c, indice) => (
                  <div key={c.clave} className={cn(indice === 0 && 'pb-1')}>
                    {indice === 0 ? (
                      <div className="font-medium text-obra-900">{c.render(fila)}</div>
                    ) : (
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="shrink-0 text-obra-500">{c.titulo}</span>
                        <span className="min-w-0 break-words text-right text-obra-700">
                          {c.render(fila)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
            {acciones && (
              <div
                className="mt-auto flex justify-end gap-1 border-t border-obra-100 pt-3"
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
