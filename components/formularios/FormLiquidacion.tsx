'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, CalendarDays, CalendarRange, Loader2, Wallet } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, useEnvio } from './base'
import { useRecursoUnico, useRetardo } from '@/lib/cliente'
import { fechasDePeriodo, type PeriodoLiquidacion } from '@/lib/dominio'
import { formatoFecha, formatoMoneda, formatoNumero, hoyTexto } from '@/lib/utils'
import type { Catalogos, Liquidacion, PreviaLiquidacion } from '@/types/dominio'

const vacio = {
  trabajadorId: '',
  tipoPeriodo: '' as PeriodoLiquidacion | '',
  /** aaaa-mm: lo usan MES y QUINCENA. */
  mes: '',
  /** '1' = del 1 al 15, '2' = del 16 al fin de mes. */
  quincena: '',
  /** Solo RANGO. */
  desde: '',
  hasta: '',
  banco: '',
  tipoCuenta: '',
  numeroCuenta: '',
  observaciones: '',
}

/** Las tres formas de elegir el lapso. Elegir una limpia las otras dos. */
const OPCIONES_PERIODO: Array<{
  valor: PeriodoLiquidacion
  titulo: string
  detalle: string
  icono: React.ComponentType<{ className?: string }>
}> = [
  { valor: 'MES', titulo: 'Mes', detalle: 'El mes completo', icono: CalendarDays },
  { valor: 'QUINCENA', titulo: 'Quincena', detalle: '1 al 15 o 16 a fin de mes', icono: CalendarDays },
  { valor: 'RANGO', titulo: 'Rango', detalle: 'Fechas a eleccion', icono: CalendarRange },
]

/** La cuenta en una linea, para el aviso. */
const cuentaEnTexto = (banco: string, tipo: string, numero: string) =>
  [banco.trim(), tipo ? tipo.charAt(0) + tipo.slice(1).toLowerCase() : '', numero.trim()]
    .filter(Boolean)
    .join(' · ')

/**
 * Liquidar: pagarle a un trabajador lo que ejecuto en un lapso, a los precios
 * que tenia acordados.
 *
 * Primero se elige a quien y el lapso; con eso aparece la vista previa, que es
 * el mismo calculo que hara el servidor al guardar. Luego la cuenta, y antes de
 * guardar un aviso que dice en una frase cuanto, a quien y a que cuenta.
 */
export function FormLiquidacion({
  abierto,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  onCerrar: () => void
  onGuardado: (creada: Liquidacion) => void
}) {
  const { data: sesion } = useSession()
  const [form, setForm] = useState(vacio)
  const [confirmando, setConfirmando] = useState(false)
  const [cuentaPropuesta, setCuentaPropuesta] = useState(false)
  const { enviando, errorGeneral, errores, guardar } = useEnvio()

  const cambiar = (campos: Partial<typeof vacio>) => setForm((f) => ({ ...f, ...campos }))

  useEffect(() => {
    if (!abierto) return
    setForm(vacio)
    setConfirmando(false)
    setCuentaPropuesta(false)
  }, [abierto])

  const { dato: catalogos } = useRecursoUnico<Catalogos>(abierto ? '/api/catalogos' : null)
  const trabajadores = useMemo(
    () =>
      [...(catalogos?.trabajadores ?? [])].sort(
        (a, b) => Number(b.activo) - Number(a.activo) || a.apellido.localeCompare(b.apellido, 'es'),
      ),
    [catalogos],
  )
  const cargoDe = (id: number) => catalogos?.cargos.find((c) => c.id === id)?.nombre ?? ''

  /**
   * Elegir una forma de periodo borra lo que se hubiera puesto en las otras:
   * un mes elegido y luego un rango no pueden convivir, porque no se sabria
   * cual manda. A la elegida se le propone el mes o la quincena en curso.
   */
  const elegirPeriodo = (tipo: PeriodoLiquidacion) => {
    const hoy = hoyTexto()
    const mesActual = hoy.slice(0, 7)
    const quincenaActual = Number(hoy.slice(8, 10)) <= 15 ? '1' : '2'
    setForm((f) => ({
      ...f,
      tipoPeriodo: tipo,
      mes: tipo === 'MES' || tipo === 'QUINCENA' ? mesActual : '',
      quincena: tipo === 'QUINCENA' ? quincenaActual : '',
      desde: '',
      hasta: '',
    }))
  }

  const rango = form.tipoPeriodo
    ? fechasDePeriodo(form.tipoPeriodo, {
        mes: form.mes,
        quincena: form.quincena,
        desde: form.desde,
        hasta: form.hasta,
      })
    : null

  const urlPrevia =
    abierto && form.trabajadorId && rango
      ? `/api/liquidaciones/previa?${new URLSearchParams({
          trabajadorId: form.trabajadorId,
          desde: rango.desde,
          hasta: rango.hasta,
        })}`
      : null
  const { dato: previa, cargando: calculando, error: errorPrevia } =
    useRecursoUnico<PreviaLiquidacion>(useRetardo(urlPrevia))
  const previaVigente = previa && urlPrevia ? previa : null

  // La cuenta a la que se le pago la ultima vez se propone una sola vez por
  // trabajador, y solo si el campo esta vacio: no pisa lo que ya se escribio.
  useEffect(() => {
    setCuentaPropuesta(false)
  }, [form.trabajadorId])
  useEffect(() => {
    if (!previa?.ultimaCuenta || cuentaPropuesta) return
    if (String(previa.trabajador.id) !== form.trabajadorId) return
    setCuentaPropuesta(true)
    setForm((f) =>
      f.numeroCuenta
        ? f
        : {
            ...f,
            banco: previa.ultimaCuenta!.banco ?? '',
            tipoCuenta: previa.ultimaCuenta!.tipoCuenta ?? '',
            numeroCuenta: previa.ultimaCuenta!.numeroCuenta,
          },
    )
  }, [previa, cuentaPropuesta, form.trabajadorId])

  const nombreTrabajador = previaVigente
    ? `${previaVigente.trabajador.nombre} ${previaVigente.trabajador.apellido}`
    : ''
  const responsable = sesion?.user ? `${sesion.user.nombre} ${sesion.user.apellido}` : '-'
  const cuentaValida = /^[0-9][0-9 -]*[0-9]$/.test(form.numeroCuenta.trim()) &&
    form.numeroCuenta.trim().length >= 4
  const listo = Boolean(previaVigente && previaVigente.total > 0 && cuentaValida && rango)

  const pedirConfirmacion = (e: React.FormEvent) => {
    e.preventDefault()
    if (listo) setConfirmando(true)
  }

  const confirmar = () => {
    if (!rango || !form.tipoPeriodo) return
    guardar(
      '/api/liquidaciones',
      'POST',
      {
        trabajadorId: form.trabajadorId,
        tipoPeriodo: form.tipoPeriodo,
        desde: rango.desde,
        hasta: rango.hasta,
        banco: form.banco,
        tipoCuenta: form.tipoCuenta,
        numeroCuenta: form.numeroCuenta,
        observaciones: form.observaciones,
        // Lo que se vio en el aviso: si el servidor calcula otra cosa, no guarda.
        totalEsperado: previaVigente?.total,
      },
      (creada) => {
        setConfirmando(false)
        onGuardado(creada as Liquidacion)
      },
    )
  }

  // Si el servidor rechaza el guardado, el aviso se cierra para que se vea el
  // motivo en el formulario.
  useEffect(() => {
    if (errorGeneral) setConfirmando(false)
  }, [errorGeneral])

  return (
    <Modal
      titulo="Nueva liquidacion"
      descripcion="Pago por lo ejecutado en un lapso, a los precios acordados con el trabajador."
      abierto={abierto}
      // Con la confirmacion abierta, Escape cierra solo la confirmacion.
      onCerrar={confirmando ? () => setConfirmando(false) : onCerrar}
      ancho="xl"
    >
      <form onSubmit={pedirConfirmacion} className="space-y-5">
        <AvisoError mensaje={errorGeneral} />

        {/* --- A quien ---------------------------------------------------- */}
        <Campo etiqueta="Trabajador" error={errores.trabajadorId} requerido>
          <Seleccion
            value={form.trabajadorId}
            onChange={(e) =>
              cambiar({ trabajadorId: e.target.value, banco: '', tipoCuenta: '', numeroCuenta: '' })
            }
            required
          >
            <option value="">Selecciona...</option>
            {trabajadores.map((t) => (
              <option key={t.id} value={t.id}>
                {t.apellido} {t.nombre} · {cargoDe(t.cargoId)}
                {t.activo ? '' : ' · inactivo'}
              </option>
            ))}
          </Seleccion>
        </Campo>

        {/* --- Por que lapso ---------------------------------------------- */}
        <section>
          <p className="etiqueta">
            Periodo<span className="ml-0.5 text-red-500">*</span>
          </p>
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {OPCIONES_PERIODO.map((o) => {
              const activo = form.tipoPeriodo === o.valor
              const Icono = o.icono
              return (
                <button
                  key={o.valor}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegirPeriodo(o.valor)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    activo
                      ? 'border-obra-900 bg-obra-900 text-white'
                      : 'border-obra-200 bg-white text-obra-700 hover:bg-obra-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Icono className="h-4 w-4" />
                    {o.titulo}
                  </span>
                  <span className={`mt-0.5 block text-[11px] ${activo ? 'text-obra-200' : 'text-obra-400'}`}>
                    {o.detalle}
                  </span>
                </button>
              )
            })}
          </div>

          {form.tipoPeriodo === 'MES' && (
            <Campo etiqueta="Mes" className="mt-3" requerido>
              <Entrada type="month" value={form.mes} onChange={(e) => cambiar({ mes: e.target.value })} required />
            </Campo>
          )}

          {form.tipoPeriodo === 'QUINCENA' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Mes" requerido>
                <Entrada type="month" value={form.mes} onChange={(e) => cambiar({ mes: e.target.value })} required />
              </Campo>
              <Campo etiqueta="Quincena" requerido>
                <Seleccion value={form.quincena} onChange={(e) => cambiar({ quincena: e.target.value })} required>
                  <option value="">Selecciona...</option>
                  <option value="1">Primera · del 1 al 15</option>
                  <option value="2">Segunda · del 16 a fin de mes</option>
                </Seleccion>
              </Campo>
            </div>
          )}

          {form.tipoPeriodo === 'RANGO' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Desde" requerido>
                <Entrada type="date" value={form.desde} onChange={(e) => cambiar({ desde: e.target.value })} required />
              </Campo>
              <Campo etiqueta="Hasta" error={errores.hasta} requerido>
                <Entrada
                  type="date"
                  value={form.hasta}
                  min={form.desde || undefined}
                  onChange={(e) => cambiar({ hasta: e.target.value })}
                  required
                />
              </Campo>
            </div>
          )}

          {rango && (
            <p className="mt-2 text-xs text-obra-500">
              Se liquida del {formatoFecha(rango.desde)} al {formatoFecha(rango.hasta)}.
            </p>
          )}
        </section>

        {/* --- Lo que se va a pagar ----------------------------------------- */}
        {urlPrevia && (
          <section className="rounded-xl border border-obra-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-obra-100 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-obra-500">
                  Informacion de la liquidacion
                </p>
                <p className="mt-0.5 text-sm text-obra-700">
                  Responsable: <span className="font-medium text-obra-900">{responsable}</span>
                </p>
              </div>
              {calculando && <Loader2 className="h-4 w-4 animate-spin text-obra-400" />}
            </div>

            {errorPrevia ? (
              <p className="px-4 py-3 text-sm text-red-700">{errorPrevia}</p>
            ) : previaVigente ? (
              <div className="space-y-3 px-4 py-3">
                <p className="text-sm text-obra-700">
                  {nombreTrabajador} · {previaVigente.trabajador.cargo.nombre}
                  {previaVigente.trabajador.documento
                    ? ` · CC ${previaVigente.trabajador.documento}`
                    : ''}
                </p>

                {previaVigente.lineas.length > 0 ? (
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
                        {previaVigente.lineas.map((l) => (
                          <tr key={`${l.actividadId}-${l.valorUnitario}`}>
                            <td className="px-3 py-2 text-obra-900">{l.actividadNombre}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatoMoneda(l.valorUnitario)} / {l.unidad}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatoNumero(l.cantidad)} {l.unidad}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.jornadas}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {formatoMoneda(l.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-obra-50">
                          <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold uppercase text-obra-600">
                            Total a pagar
                          </td>
                          <td className="px-3 py-2 text-right text-base font-semibold tabular-nums text-obra-900">
                            {formatoMoneda(previaVigente.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-lg bg-obra-50 px-3 py-2 text-sm text-obra-600">
                    No hay jornadas con precio pendientes de pago en este lapso.
                  </p>
                )}

                {previaVigente.sinPrecio.length > 0 && (
                  <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      {previaVigente.sinPrecio.length} jornada
                      {previaVigente.sinPrecio.length === 1 ? '' : 's'} sin precio acordado no se
                      liquida{previaVigente.sinPrecio.length === 1 ? '' : 'n'}:{' '}
                      {previaVigente.sinPrecio
                        .map((j) => `${j.codigoRegistro} (${j.actividad}, ${formatoNumero(j.cantidad)} ${j.unidad})`)
                        .join(', ')}
                      . El precio se guarda en la jornada el dia que se registra.
                    </p>
                  </div>
                )}

                {previaVigente.yaPagadas.length > 0 && (
                  <p className="text-xs text-obra-500">
                    {previaVigente.yaPagadas.length} jornada
                    {previaVigente.yaPagadas.length === 1 ? '' : 's'} de este lapso ya se pag
                    {previaVigente.yaPagadas.length === 1 ? 'o' : 'aron'} en{' '}
                    {[...new Set(previaVigente.yaPagadas.map((j) => j.liquidacion))].join(', ')} y
                    no se vuelve{previaVigente.yaPagadas.length === 1 ? '' : 'n'} a pagar.
                  </p>
                )}
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-obra-500">Calculando...</p>
            )}
          </section>
        )}

        {/* --- A que cuenta ------------------------------------------------- */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
            Cuenta para el deposito
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Numero de cuenta" error={errores.numeroCuenta} requerido className="sm:col-span-1">
              <Entrada
                inputMode="numeric"
                autoComplete="off"
                placeholder="Solo digitos"
                value={form.numeroCuenta}
                onChange={(e) => cambiar({ numeroCuenta: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Banco" error={errores.banco}>
              <Entrada value={form.banco} onChange={(e) => cambiar({ banco: e.target.value })} />
            </Campo>
            <Campo etiqueta="Tipo de cuenta" error={errores.tipoCuenta}>
              <Seleccion value={form.tipoCuenta} onChange={(e) => cambiar({ tipoCuenta: e.target.value })}>
                <option value="">Sin indicar</option>
                <option value="AHORROS">Ahorros</option>
                <option value="CORRIENTE">Corriente</option>
              </Seleccion>
            </Campo>
          </div>
          {cuentaPropuesta && previa?.ultimaCuenta && (
            <p className="mt-1 text-xs text-obra-400">
              Propuesta a partir de la ultima liquidacion de este trabajador.
            </p>
          )}
        </section>

        <Campo etiqueta="Observaciones" error={errores.observaciones}>
          <AreaTexto
            rows={2}
            value={form.observaciones}
            onChange={(e) => cambiar({ observaciones: e.target.value })}
          />
        </Campo>

        <div className="flex flex-col-reverse gap-2 border-t border-obra-100 pt-4 sm:flex-row sm:justify-end">
          <Boton type="button" variante="contorno" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!listo}>
            Liquidar {previaVigente && previaVigente.total > 0 ? formatoMoneda(previaVigente.total) : ''}
          </Boton>
        </div>
      </form>

      {/*
        El aviso sale en una ventana encima del formulario: es la ultima
        oportunidad de ver cuanto, a quien y a que cuenta antes de pagar.
      */}
      <Modal
        titulo="Confirmar liquidacion"
        abierto={confirmando && Boolean(previaVigente)}
        onCerrar={() => setConfirmando(false)}
      >
        {previaVigente && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-xl border border-acento-300 bg-acento-50 px-4 py-4">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-acento-700" />
              <p className="text-sm leading-relaxed text-obra-900">
                Se esta liquidando{' '}
                <strong className="tabular-nums">{formatoMoneda(previaVigente.total)}</strong> para{' '}
                <strong>{nombreTrabajador}</strong> a la cuenta{' '}
                <strong>{cuentaEnTexto(form.banco, form.tipoCuenta, form.numeroCuenta)}</strong>.
              </p>
            </div>
            <p className="text-xs text-obra-500">
              {rango && `Periodo del ${formatoFecha(rango.desde)} al ${formatoFecha(rango.hasta)}. `}
              Las {previaVigente.jornadas.length} jornadas quedan marcadas como pagadas y ya no se
              podran editar. Responsable: {responsable}.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Boton type="button" variante="contorno" onClick={() => setConfirmando(false)}>
                Revisar
              </Boton>
              <Boton type="button" onClick={confirmar} disabled={enviando}>
                {enviando ? 'Guardando...' : 'Confirmar liquidacion'}
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  )
}
