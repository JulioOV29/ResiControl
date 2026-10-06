'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion, AreaTexto } from '@/components/ui/input'
import { AvisoError, PieFormulario, VentanaError, useEnvio } from './base'
import { pedir, useRecurso, useRecursoUnico } from '@/lib/cliente'
import {
  fechaParaInput,
  formatoFecha,
  formatoMoneda,
  formatoNumero,
  formatoPorcentaje,
  hoyTexto,
} from '@/lib/utils'
import { dateAHora, formatoDuracion, indicadoresJornada, horaADate } from '@/lib/calculos'
import { conProyecto } from '@/lib/etiquetas'
import type { Cuadrilla, Meta, Obra, Registro } from '@/types/dominio'

/** true si el trabajador tiene precio para esa actividad. */
function tienePrecio(
  trabajador: { tarifas?: Array<{ actividadId: number }> } | undefined | null,
  actividadId: string | number | null | undefined,
) {
  if (!actividadId) return true
  return (trabajador?.tarifas ?? []).some((t) => t.actividadId === Number(actividadId))
}

// Fecha local, no UTC (ver hoyTexto).
const hoy = hoyTexto

// La fecha se pone al abrir el formulario (no al cargar la pagina).
const vacio = {
  obraId: '',
  fechaEjecucion: '',
  cuadrillaId: '',
  trabajadorId: '',
  m2Ejecutados: '',
  horaInicio: '07:00',
  horaFinal: '17:00',
  tiempoRecesoMin: '60',
  m2Meta: '',
  observaciones: '',
}

/**
 * Avance de una obra abierta: hereda ubicacion y medidas, y se encadena
 * al ultimo registro de la obra.
 */
export function FormRegistroAvance({
  abierto,
  registro,
  obraPreseleccionada,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  /** Solo al editar. */
  registro: Registro | null
  /** Obra elegida de antemano (opcional). */
  obraPreseleccionada?: number | null
  onCerrar: () => void
  onGuardado: (creado: Registro) => void
}) {
  const {
    enviando,
    errorGeneral,
    errores,
    guardar,
    ventanaError,
    mostrarVentanaError,
    cerrarVentanaError,
  } = useEnvio(abierto)
  const [form, setForm] = useState(vacio)
  const [metaTocada, setMetaTocada] = useState(false)

  const cambiar = (campos: Partial<typeof vacio>) => setForm((f) => ({ ...f, ...campos }))

  // Al editar se necesita la obra aunque este terminada.
  const obras = useRecurso<Obra>(
    abierto ? (registro ? '/api/obras' : '/api/obras?abiertas=1') : null,
  )
  const obra = obras.datos.find((o) => String(o.id) === form.obraId) ?? null

  /** La unidad es la de la actividad de la obra. */
  const unidad = obra?.actividad?.unidadMedida ?? 'm2'

  const cuadrillas = useRecurso<Cuadrilla>(
    abierto && obra ? `/api/cuadrillas?proyectoId=${obra.elemento?.zona.piso.torre.proyecto.id}` : null,
  )
  const cuadrilla = useRecursoUnico<Cuadrilla>(
    abierto && form.cuadrillaId ? `/api/cuadrillas/${form.cuadrillaId}` : null,
  )
  const integrantes = (cuadrilla.dato?.integrantes ?? []).filter((i) => i.activo)
  const trabajadorElegido = integrantes.find((i) => String(i.trabajadorId) === form.trabajadorId)
  const cargoId = trabajadorElegido?.trabajador?.cargo.id ?? null

  /** Precio del trabajador para la actividad de la obra. */
  const tarifaJornada = obra
    ? (trabajadorElegido?.trabajador?.tarifas ?? []).find(
        (t) => t.actividadId === obra.actividadId,
      )
    : undefined
  // Solo con el trabajador ya cargado: mientras carga la cuadrilla no se sabe.
  const faltaTarifa = Boolean(obra && trabajadorElegido && !tarifaJornada)

  useEffect(() => {
    if (!abierto) return
    // Al editar se respeta la meta que ya tenia la jornada.
    setMetaTocada(Boolean(registro))

    if (registro) {
      setForm({
        obraId: String(registro.registroOrigenId ?? registro.id),
        fechaEjecucion: fechaParaInput(registro.fechaEjecucion),
        cuadrillaId: String(registro.cuadrillaId),
        trabajadorId: registro.trabajadorId ? String(registro.trabajadorId) : '',
        m2Ejecutados: String(registro.m2Ejecutados),
        horaInicio: dateAHora(registro.horaInicio),
        horaFinal: dateAHora(registro.horaFinal),
        tiempoRecesoMin: String(registro.tiempoRecesoMin),
        m2Meta: registro.m2Meta === null ? '' : String(registro.m2Meta),
        observaciones: registro.observaciones || '',
      })
      return
    }

    setForm({
      ...vacio,
      fechaEjecucion: hoy(),
      obraId: obraPreseleccionada ? String(obraPreseleccionada) : '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, registro, obraPreseleccionada])

  // Al elegir la obra se proponen la cuadrilla del ultimo dia y la fecha de hoy.
  useEffect(() => {
    if (!obra || registro) return
    cambiar({
      cuadrillaId: String(obra.cuadrillaId),
      trabajadorId: obra.trabajadorId ? String(obra.trabajadorId) : '',
      fechaEjecucion: hoy(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obra?.id])

  useEffect(() => {
    if (!abierto || metaTocada || !obra) return

    const parametros = new URLSearchParams({
      proyectoId: String(obra.elemento?.zona.piso.torre.proyecto.id ?? ''),
      actividadId: String(obra.actividadId),
      fecha: form.fechaEjecucion,
      ...(cargoId ? { cargoId: String(cargoId) } : {}),
    })

    let cancelado = false
    // Mientras el usuario no escriba la meta, sigue a la meta vigente.
    pedir<Meta | null>(`/api/metas/vigente?${parametros}`).then((r) => {
      if (cancelado || !r.ok) return
      const propuesta = r.datos?.m2Objetivo ? String(r.datos.m2Objetivo) : ''
      setForm((f) => (f.m2Meta === propuesta ? f : { ...f, m2Meta: propuesta }))
    })
    return () => {
      cancelado = true
    }
  }, [abierto, metaTocada, obra, form.fechaEjecucion, cargoId])

  /**
   * Fechas permitidas: despues del registro anterior y antes del siguiente.
   * Uno nuevo va despues del ultimo de la cadena; nunca despues de hoy.
   */
  const limitesFecha = useMemo(() => {
    if (!obra) return { min: undefined, max: hoy() }
    const fechaDe = (id: number | null | undefined) =>
      id === obra.id
        ? obra.fechaEjecucion.slice(0, 10)
        : obra.avances.find((a) => a.id === id)?.fechaEjecucion.slice(0, 10)
    if (!registro) {
      const ultimo = obra.avances.length
        ? obra.avances[obra.avances.length - 1].fechaEjecucion
        : obra.fechaEjecucion
      return { min: ultimo.slice(0, 10), max: hoy() }
    }
    const siguiente = obra.avances.find((a) => a.registroAnteriorId === registro.id)
    return {
      min: fechaDe(registro.registroAnteriorId),
      max: siguiente ? siguiente.fechaEjecucion.slice(0, 10) : hoy(),
    }
  }, [obra, registro])

  /** Lo que lleva la obra sin contar el registro que se edita. */
  const saldo = useMemo(() => {
    if (!obra) return null
    const propio = registro ? registro.m2Ejecutados : 0
    const ejecutadoOtros = obra.resumen.ejecutado - propio
    return {
      total: obra.resumen.total,
      ejecutadoOtros,
      pendiente: Math.max(0, obra.resumen.total - ejecutadoOtros),
    }
  }, [obra, registro])

  const vista = useMemo(() => {
    const valido = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!valido.test(form.horaInicio) || !valido.test(form.horaFinal)) return null

    const jornada = indicadoresJornada({
      m2Ejecutados: form.m2Ejecutados || 0,
      // Vacio = sin meta (no cuenta para el cumplimiento).
      m2Meta: form.m2Meta,
      horaInicio: horaADate(form.horaInicio),
      horaFinal: horaADate(form.horaFinal),
      tiempoRecesoMin: Number(form.tiempoRecesoMin) || 0,
    })

    if (!saldo) return { jornada, obra: null }

    const acumulado = saldo.ejecutadoOtros + (Number(form.m2Ejecutados) || 0)
    return {
      jornada,
      obra: {
        total: saldo.total,
        acumulado,
        pendiente: Math.max(0, saldo.total - acumulado),
        avance: saldo.total > 0 ? acumulado / saldo.total : 0,
        completa: saldo.total > 0 && acumulado >= saldo.total - 0.005,
      },
    }
  }, [form, saldo])

  const excedido = Boolean(saldo && Number(form.m2Ejecutados) > saldo.pendiente + 0.005)

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    if (excedido && saldo) {
      mostrarVentanaError(
        `A la obra solo le quedan ${formatoNumero(saldo.pendiente)} ${unidad} por ejecutar.`,
      )
      return
    }
    // Sin precio no se guarda (al editar, solo si cambia el trabajador).
    const cambiaTrabajador = !registro || form.trabajadorId !== String(registro.trabajadorId ?? '')
    if (cambiaTrabajador && faltaTarifa) {
      mostrarVentanaError(
        `${trabajadorElegido?.trabajador?.nombre ?? 'El trabajador'} ${trabajadorElegido?.trabajador?.apellido ?? ''} no tiene precio acordado para ${obra?.actividad?.nombre ?? 'esta actividad'}. Acuerda el precio en su ficha (Trabajadores) y vuelve a guardar.`,
      )
      return
    }

    const { obraId, ...datos } = form
    void obraId

    if (registro) {
      guardar(`/api/registros/${registro.id}`, 'PUT', datos, (creado) =>
        onGuardado(creado as Registro),
      )
      return
    }

    // Se encadena al ultimo registro de la obra.
    guardar(
      '/api/registros',
      'POST',
      { ...datos, registroAnteriorId: obra?.resumen.ultimoId },
      (creado) => onGuardado(creado as Registro),
    )
  }

  const ubicacion = obra?.elemento
    ? `${obra.elemento.zona.piso.torre.nombre} · ${obra.elemento.zona.nombre} · ${obra.elemento.codigoDwg} ${obra.elemento.descripcion}`
    : ''

  return (
    <Modal
      titulo={registro ? `Editar avance ${registro.codigoRegistro}` : 'Nuevo registro de avance'}
      descripcion="Continua una obra ya abierta. La ubicacion y las medidas se heredan."
      abierto={abierto}
      // Con la ventana de error abierta, Escape solo la cierra a ella.
      onCerrar={ventanaError ? cerrarVentanaError : onCerrar}
      ancho="xl"
    >
      <form onSubmit={enviarFormulario} className="space-y-5">
        <AvisoError mensaje={errorGeneral} />

        <Campo etiqueta="Obra que continua" error={errores.registroAnteriorId} requerido>
          <Seleccion
            value={form.obraId}
            onChange={(e) => cambiar({ obraId: e.target.value, cuadrillaId: '', trabajadorId: '' })}
            disabled={Boolean(registro)}
            required
          >
            <option value="">Selecciona...</option>
            {obras.datos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigoRegistro} · {o.actividad?.nombre} · {o.elemento?.codigoDwg}{' '}
                {o.elemento?.descripcion} — {formatoPorcentaje(Math.min(1, o.resumen.avance))}{' '}
                ejecutado, quedan {formatoNumero(o.resumen.pendiente)}{' '}
                {o.actividad?.unidadMedida ?? 'm2'}
              </option>
            ))}
          </Seleccion>
        </Campo>

        {!obras.cargando && obras.datos.length === 0 && (
          <p className="rounded-lg border border-acento-200 bg-acento-50 px-3 py-2 text-xs text-acento-800">
            No hay obras abiertas. Empieza con un registro de obra nuevo.
          </p>
        )}

        {obra && (
          <section className="rounded-xl border border-obra-200 bg-obra-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-obra-500">
              Datos heredados de la obra
            </h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-obra-500">Ubicacion</dt>
                <dd className="mt-0.5 text-sm text-obra-900">{ubicacion}</dd>
              </div>
              <div>
                <dt className="text-xs text-obra-500">Actividad</dt>
                <dd className="mt-0.5 text-sm text-obra-900">{obra.actividad?.nombre}</dd>
              </div>
              <div>
                <dt className="text-xs text-obra-500">Elemento</dt>
                <dd className="mt-0.5 text-sm tabular-nums text-obra-900">
                  {formatoNumero(obra.largo)} x {formatoNumero(obra.alto)} m ·{' '}
                  {formatoNumero(obra.resumen.total)} {unidad} por ejecutar
                </dd>
              </div>
              <div>
                <dt className="text-xs text-obra-500">Se encadena a</dt>
                <dd className="mt-0.5 text-sm font-medium text-obra-900">
                  {obra.resumen.ultimoCodigo}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-obra-500">Quedara como</dt>
                <dd className="mt-0.5 text-sm font-medium text-obra-900">
                  {obra.codigoRegistro} · SR
                  {registro
                    ? (registro.numeroAvance ?? '')
                    : Math.max(0, ...obra.avances.map((a) => a.numeroAvance ?? 0)) + 1}
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-obra-200 pt-3">
              <p className="text-xs text-obra-500">
                {obra.resumen.jornadas} registro(s) previos, el ultimo del{' '}
                {formatoFecha(
                  obra.avances.length
                    ? obra.avances[obra.avances.length - 1].fechaEjecucion
                    : obra.fechaEjecucion,
                )}
                . Lleva {formatoNumero(obra.resumen.ejecutado)} {unidad} de{' '}
                {formatoNumero(obra.resumen.total)} {unidad}. El avance no puede tener fecha
                anterior a ese dia.
              </p>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
            Jornada
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Fecha de ejecucion" error={errores.fechaEjecucion} requerido>
              <Entrada
                type="date"
                value={form.fechaEjecucion}
                min={limitesFecha.min}
                max={limitesFecha.max}
                onChange={(e) => cambiar({ fechaEjecucion: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Cuadrilla" error={errores.cuadrillaId} requerido>
              <Seleccion
                value={form.cuadrillaId}
                onChange={(e) => cambiar({ cuadrillaId: e.target.value, trabajadorId: '' })}
                disabled={!obra}
                required
              >
                <option value="">Selecciona...</option>
                {cuadrillas.datos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {conProyecto(c.nombre, c.proyecto?.codigo)}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Trabajador" error={errores.trabajadorId} requerido>
              <Seleccion
                value={form.trabajadorId}
                onChange={(e) => cambiar({ trabajadorId: e.target.value })}
                disabled={!form.cuadrillaId}
                required
              >
                <option value="">Elige quien hizo la jornada</option>
                {integrantes.map((i) => {
                  // Sin precio para la actividad no se puede elegir.
                  const sinPrecio = Boolean(obra?.actividad?.id) && !tienePrecio(i.trabajador, obra?.actividad?.id)
                  return (
                    <option
                      key={i.id}
                      value={i.trabajadorId}
                      disabled={sinPrecio && String(i.trabajadorId) !== form.trabajadorId}
                    >
                      {i.trabajador?.apellido} {i.trabajador?.nombre}
                      {sinPrecio ? ' · sin precio acordado' : ''}
                    </option>
                  )
                })}
              </Seleccion>
            </Campo>
          </div>

          {trabajadorElegido?.trabajador && (
            <p className="mt-2 text-xs text-obra-500">
              Cargo: {trabajadorElegido.trabajador.cargo.nombre}
              {tarifaJornada &&
                ` · ${formatoMoneda(tarifaJornada.valorM2)} por unidad en ${obra?.actividad?.nombre ?? 'esta actividad'}`}
            </p>
          )}

          {faltaTarifa && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {trabajadorElegido?.trabajador?.nombre ?? 'Este trabajador'} no tiene precio
              acordado para {obra?.actividad?.nombre ?? 'esta actividad'}: no se puede asignar.
              Acuerdalo primero en su ficha, en la seccion Trabajadores.
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Campo etiqueta={`${unidad} ejecutados hoy`} error={errores.m2Ejecutados} requerido>
              <Entrada
                type="number"
                step="0.01"
                min="0.01"
                max={saldo ? saldo.pendiente : undefined}
                value={form.m2Ejecutados}
                onChange={(e) => cambiar({ m2Ejecutados: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta={`${unidad} meta del dia`} error={errores.m2Meta}>
              <Entrada
                type="number"
                step="0.01"
                value={form.m2Meta}
                onChange={(e) => {
                  setMetaTocada(true)
                  cambiar({ m2Meta: e.target.value })
                }}
              />
            </Campo>
            <Campo etiqueta="Hora de inicio" error={errores.horaInicio} requerido>
              <Entrada
                type="time"
                value={form.horaInicio}
                onChange={(e) => cambiar({ horaInicio: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Hora final" error={errores.horaFinal} requerido>
              <Entrada
                type="time"
                value={form.horaFinal}
                onChange={(e) => cambiar({ horaFinal: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Receso (minutos)" error={errores.tiempoRecesoMin} requerido>
              <Entrada
                type="number"
                step="15"
                min="0"
                value={form.tiempoRecesoMin}
                onChange={(e) => cambiar({ tiempoRecesoMin: e.target.value })}
                required
              />
            </Campo>
          </div>

          {excedido && saldo && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Te pasaste: a la obra solo le quedan {formatoNumero(saldo.pendiente)} {unidad} por
              ejecutar.
            </p>
          )}
        </section>

        {vista && (
          <section className="rounded-xl border border-acento-200 bg-acento-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-acento-800">
              Calculado automaticamente
            </h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-acento-800">Tiempo efectivo</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-obra-900">
                  {formatoDuracion(vista.jornada.minutosEfectivos)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-acento-800">Rendimiento del dia</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-obra-900">
                  {vista.jornada.rendimiento === null
                    ? '-'
                    : `${formatoNumero(vista.jornada.rendimiento)} ${unidad}/h`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-acento-800">Cumplimiento del dia</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-obra-900">
                  {formatoPorcentaje(vista.jornada.cumplimiento)}
                </dd>
              </div>
            </dl>

            {vista.obra && (
              <div className="mt-4 border-t border-acento-200 pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-acento-800">
                    Como queda la obra con este avance
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-obra-900">
                    {formatoPorcentaje(Math.min(1, vista.obra.avance))}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-acento-200">
                  <div
                    className={
                      vista.obra.completa
                        ? 'h-full rounded-full bg-menta-400'
                        : 'h-full rounded-full bg-acento-500'
                    }
                    style={{ width: `${Math.min(100, vista.obra.avance * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-acento-800">
                  {formatoNumero(vista.obra.acumulado)} de {formatoNumero(vista.obra.total)}{' '}
                  {unidad}
                  {vista.obra.completa
                    ? '. Al guardar, la obra queda terminada.'
                    : `, quedarian ${formatoNumero(vista.obra.pendiente)} ${unidad}.`}
                </p>
              </div>
            )}
          </section>
        )}

        <Campo etiqueta="Observaciones" error={errores.observaciones}>
          <AreaTexto
            value={form.observaciones}
            onChange={(e) => cambiar({ observaciones: e.target.value })}
          />
        </Campo>

        <PieFormulario
          enviando={enviando}
          onCancelar={onCerrar}
          textoGuardar="Guardar avance"
          error={errorGeneral}
        />
      </form>
      <VentanaError mensaje={ventanaError} onCerrar={cerrarVentanaError} />
    </Modal>
  )
}
