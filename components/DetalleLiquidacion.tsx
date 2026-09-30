'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Boton } from '@/components/ui/button'
import { borrar, useRecursoUnico } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { ETIQUETA_PERIODO } from '@/lib/dominio'
import { formatoFecha, formatoMoneda, formatoNumero } from '@/lib/utils'
import type { Liquidacion } from '@/types/dominio'

/** Un dato con su etiqueta encima. */
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-obra-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-obra-900">{children}</dd>
    </div>
  )
}

/** La cuenta en una linea: "Bancolombia · Ahorros · 1234 5678". */
export function textoCuenta(l: Pick<Liquidacion, 'banco' | 'tipoCuenta' | 'numeroCuenta'>) {
  const tipo = l.tipoCuenta ? l.tipoCuenta.charAt(0) + l.tipoCuenta.slice(1).toLowerCase() : null
  return [l.banco, tipo, l.numeroCuenta].filter(Boolean).join(' · ')
}

/** El lapso en palabras: "Quincena · 16/09/2026 a 30/09/2026". */
export function textoPeriodo(l: Pick<Liquidacion, 'tipoPeriodo' | 'desde' | 'hasta'>) {
  return `${ETIQUETA_PERIODO[l.tipoPeriodo]} · ${formatoFecha(l.desde)} a ${formatoFecha(l.hasta)}`
}

/**
 * El comprobante de una liquidacion: a quien, por que lapso, quien la hizo, a
 * que cuenta, y el detalle de lo pagado por actividad y por jornada.
 */
export function DetalleLiquidacion({
  liquidacionId,
  onCerrar,
  onAnulada,
}: {
  liquidacionId: number | null
  onCerrar: () => void
  onAnulada?: () => void
}) {
  const puede = usePuede()
  const { dato: l, cargando, error } = useRecursoUnico<Liquidacion>(
    liquidacionId ? `/api/liquidaciones/${liquidacionId}` : null,
  )
  const [anulando, setAnulando] = useState(false)
  const [confirmarAnular, setConfirmarAnular] = useState(false)
  const [errorAnular, setErrorAnular] = useState('')

  const anular = async () => {
    if (!l) return
    setAnulando(true)
    const r = await borrar(`/api/liquidaciones/${l.id}`)
    setAnulando(false)
    if (r.ok) {
      setConfirmarAnular(false)
      onAnulada?.()
    } else {
      setErrorAnular(r.error)
    }
  }

  return (
    <Modal
      titulo={l ? `Liquidacion ${l.codigo}` : 'Liquidacion'}
      descripcion={l ? textoPeriodo(l) : undefined}
      abierto={Boolean(liquidacionId)}
      onCerrar={onCerrar}
      ancho="xl"
    >
      {cargando || !l ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-obra-500">
          {error || (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-acento-200 bg-acento-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-acento-800">
              Total a pagar
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-obra-900">
              {formatoMoneda(l.total)}
            </p>
            <p className="mt-1 text-sm text-obra-700">
              a {l.trabajador.nombre} {l.trabajador.apellido}, cuenta {textoCuenta(l)}
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Trabajador">
              {l.trabajador.nombre} {l.trabajador.apellido}
              <span className="block text-xs text-obra-500">
                {l.trabajador.cargo.nombre}
                {l.trabajador.documento ? ` · CC ${l.trabajador.documento}` : ''}
              </span>
            </Dato>
            <Dato etiqueta="Responsable de la liquidacion">
              {l.usuarioLiquida.nombre} {l.usuarioLiquida.apellido}
              <span className="block text-xs text-obra-500">
                {l.usuarioLiquida.email} · {formatoFecha(l.createdAt)}
              </span>
            </Dato>
            <Dato etiqueta="Periodo">{textoPeriodo(l)}</Dato>
            <Dato etiqueta="Cuenta de deposito">{textoCuenta(l)}</Dato>
          </dl>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-obra-500">
              Informacion de pago
            </h3>
            <div className="overflow-x-auto rounded-lg border border-obra-200">
              <table className="w-full text-sm">
                <thead className="bg-obra-50 text-left text-xs text-obra-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Actividad</th>
                    <th className="px-3 py-2 text-right font-medium">Precio acordado</th>
                    <th className="px-3 py-2 text-right font-medium">Trabajado</th>
                    <th className="px-3 py-2 text-right font-medium">Jornadas</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obra-100">
                  {(l.lineas ?? []).map((linea) => (
                    <tr key={linea.id}>
                      <td className="px-3 py-2 text-obra-900">{linea.actividadNombre}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatoMoneda(linea.valorUnitario)} / {linea.unidad}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatoNumero(linea.cantidad)} {linea.unidad}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{linea.jornadas}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatoMoneda(linea.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-obra-50">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold uppercase text-obra-600">
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-obra-900">
                      {formatoMoneda(l.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {l.registros && l.registros.length > 0 && (
            <details className="rounded-lg border border-obra-200">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-obra-700">
                Las {l.registros.length} jornadas pagadas
              </summary>
              <ul className="divide-y divide-obra-100 border-t border-obra-100 text-sm">
                {l.registros.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="font-medium text-obra-900">{r.codigoRegistro}</span>{' '}
                      <span className="text-obra-500">
                        {formatoFecha(r.fechaEjecucion)} · {r.actividad} · {r.elemento}
                      </span>
                    </span>
                    <span className="tabular-nums text-obra-700">
                      {formatoNumero(r.cantidad)} {r.unidad} × {formatoMoneda(r.valorUnitario)} ={' '}
                      <span className="font-medium">{formatoMoneda(r.subtotal)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {l.observaciones && (
            <div className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2">
              <p className="text-xs text-obra-500">Observaciones</p>
              <p className="mt-1 text-sm text-obra-700">{l.observaciones}</p>
            </div>
          )}

          {errorAnular && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorAnular}
            </div>
          )}

          {confirmarAnular ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              <p>
                Se anulara la liquidacion {l.codigo} por {formatoMoneda(l.total)}. Sus{' '}
                {l.registros?.length ?? 0} jornadas vuelven a quedar pendientes de pago.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Boton variante="contorno" tamano="sm" onClick={() => setConfirmarAnular(false)}>
                  Cancelar
                </Boton>
                <Boton variante="peligro" tamano="sm" onClick={anular} disabled={anulando}>
                  {anulando ? 'Anulando...' : 'Anular liquidacion'}
                </Boton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {puede.administrar && (
                <Boton variante="fantasma" onClick={() => setConfirmarAnular(true)}>
                  <Trash2 className="h-4 w-4" />
                  Anular
                </Boton>
              )}
              <Boton onClick={onCerrar}>Cerrar</Boton>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
