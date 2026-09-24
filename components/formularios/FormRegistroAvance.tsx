'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion, AreaTexto } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
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

// La fecha del equipo, no la UTC: ver hoyTexto en lib/utils.
const hoy = hoyTexto

/** El dia siguiente a una fecha en formato aaaa-mm-dd. */
const diaSiguiente = (fecha: string) => {
  const d = new Date(`${fecha}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const vacio = {
  obraId: '',
  fechaEjecucion: hoy(),
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
 * Continua una obra ya abierta. No pide ubicacion ni medidas: las hereda del
 * registro que abrio la obra, y se encadena al ultimo registro de esa obra.
 */
export function FormRegistroAvance({
  abierto,
  registro,
  obraPreseleccionada,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  /** Solo al editar un avance ya guardado. */
  registro: Registro | null
  /** Id del registro que abrio la obra, cuando se entra desde una obra concreta. */
  obraPreseleccionada?: number | null
  onCerrar: () => void
  onGuardado: (creado: Registro) => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState(vacio)
  const [metaTocada, setMetaTocada] = useState(false)

  const cambiar = (campos: Partial<typeof vacio>) => setForm((f) => ({ ...f, ...campos }))

  // Al editar hace falta la obra completa aunque ya este terminada.
  const obras = useRecurso<Obra>(
    abierto ? (registro ? '/api/obras' : '/api/obras?abiertas=1') : null,
  )
  const obra = obras.datos.find((o) => String(o.id) === form.obraId) ?? null

  const cuadrillas = useRecurso<Cuadrilla>(
    abierto && obra ? `/api/cuadrillas?proyectoId=${obra.elemento?.zona.piso.torre.proyecto.id}` : null,
  )
  const cuadrilla = useRecursoUnico<Cuadrilla>(
    abierto && form.cuadrillaId ? `/api/cuadrillas/${form.cuadrillaId}` : null,
  )
  const integrantes = (cuadrilla.dato?.integrantes ?? []).filter((i) => i.activo)
  const trabajadorElegido = integrantes.find((i) => String(i.trabajadorId) === form.trabajadorId)
  const cargoId = trabajadorElegido?.trabajador?.cargo.id ?? null

  /**
   * La actividad la hereda la obra, asi que el precio de esta jornada es el que
   * tiene el trabajador elegido para la actividad de la obra. Sin precio la
   * jornada se guarda igual, pero sin importe, y se avisa antes de guardar.
   */
  const tarifaJornada = obra
    ? (trabajadorElegido?.trabajador?.tarifas ?? []).find(
        (t) => t.actividadId === obra.actividadId,
      )
    : undefined
  const faltaTarifa = Boolean(obra && form.trabajadorId && !tarifaJornada)

  useEffect(() => {
    if (!abierto) return
    setMetaTocada(false)

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

    setForm({ ...vacio, obraId: obraPreseleccionada ? String(obraPreseleccionada) : '' })
  }, [abierto, registro, obraPreseleccionada])

  // Al elegir la obra se hereda la cuadrilla del ultimo dia, que casi siempre
  // sigue siendo la misma, y la fecha se propone como el dia siguiente al
  // ultimo trabajado: proponer "hoy" fallaba en cuanto la obra venia de una
  // fecha posterior, que es lo normal con datos cargados por adelantado.
  useEffect(() => {
    if (!obra || registro) return
    const propuesta = ultimaFecha ? diaSiguiente(ultimaFecha) : hoy()
    cambiar({
      cuadrillaId: String(obra.cuadrillaId),
      trabajadorId: obra.trabajadorId ? String(obra.trabajadorId) : '',
      fechaEjecucion: propuesta > hoy() ? propuesta : hoy(),
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
    pedir<Meta | null>(`/api/metas/vigente?${parametros}`).then((r) => {
      if (cancelado || !r.ok || !r.datos?.m2Objetivo) return
      setForm((f) => (f.m2Meta ? f : { ...f, m2Meta: String(r.datos!.m2Objetivo) }))
    })
    return () => {
      cancelado = true
    }
  }, [abierto, metaTocada, obra, form.fechaEjecucion, cargoId])

  /** Fecha del ultimo dia trabajado en la obra. El avance no puede ser antes. */
  const ultimaFecha = obra
    ? (obra.avances.length
        ? obra.avances[obra.avances.length - 1].fechaEjecucion
        : obra.fechaEjecucion
      ).slice(0, 10)
    : null

  /** Lo que lleva la obra sin contar el registro que se esta editando. */
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
      // Vacio significa "sin meta", no "meta cero": una jornada sin meta se
      // queda fuera del cumplimiento en vez de contar como incumplida.
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
    const { obraId, ...datos } = form
    void obraId

    if (registro) {
      guardar(`/api/registros/${registro.id}`, 'PUT', datos, (creado) =>
        onGuardado(creado as Registro),
      )
      return
    }

    // El avance se encadena al ultimo registro de la obra, no a la raiz.
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
      onCerrar={onCerrar}
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
                ejecutado, quedan {formatoNumero(o.resumen.pendiente)} m2
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
                  {formatoNumero(obra.largo)} x {formatoNumero(obra.alto)} ={' '}
                  {formatoNumero(obra.resumen.total)} m2
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
                . Lleva {formatoNumero(obra.resumen.ejecutado)} m2 de{' '}
                {formatoNumero(obra.resumen.total)} m2. El avance no puede tener fecha
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
                min={ultimaFecha ?? undefined}
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
            <Campo etiqueta="Trabajador" error={errores.trabajadorId}>
              <Seleccion
                value={form.trabajadorId}
                onChange={(e) => cambiar({ trabajadorId: e.target.value })}
                disabled={!form.cuadrillaId}
              >
                <option value="">Sin asignar</option>
                {integrantes.map((i) => (
                  <option key={i.id} value={i.trabajadorId}>
                    {i.trabajador?.apellido} {i.trabajador?.nombre}
                  </option>
                ))}
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
            <p className="mt-2 rounded-lg border border-acento-200 bg-acento-50 px-3 py-2 text-xs text-acento-800">
              {trabajadorElegido?.trabajador?.nombre ?? 'Este trabajador'} no tiene precio
              acordado para {obra?.actividad?.nombre ?? 'esta actividad'}, asi que la jornada se
              guardara sin importe. Se arregla en su ficha, en la seccion Trabajadores.
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Campo etiqueta="m2 ejecutados hoy" error={errores.m2Ejecutados} requerido>
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
            <Campo etiqueta="m2 meta del dia" error={errores.m2Meta}>
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
              Te pasaste: a la obra solo le quedan {formatoNumero(saldo.pendiente)} m2 por
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
                    : `${formatoNumero(vista.jornada.rendimiento)} m2/h`}
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
                        ? 'h-full rounded-full bg-emerald-500'
                        : 'h-full rounded-full bg-acento-500'
                    }
                    style={{ width: `${Math.min(100, vista.obra.avance * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-acento-800">
                  {formatoNumero(vista.obra.acumulado)} de {formatoNumero(vista.obra.total)} m2
                  {vista.obra.completa
                    ? '. Al guardar, la obra queda terminada.'
                    : `, quedarian ${formatoNumero(vista.obra.pendiente)} m2.`}
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
    </Modal>
  )
}
