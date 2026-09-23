'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion, AreaTexto } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { pedir, useRecurso, useRecursoUnico } from '@/lib/cliente'
import {
  fechaParaInput,
  formatoMoneda,
  formatoNumero,
  formatoPorcentaje,
  hoyTexto,
} from '@/lib/utils'
import { dateAHora, formatoDuracion, indicadoresJornada, horaADate } from '@/lib/calculos'
import { crearEtiquetas } from '@/lib/etiquetas'
import type { Catalogos, Cuadrilla, Frente, Meta, Registro, Tarea } from '@/types/dominio'

// La fecha del equipo, no la UTC: ver hoyTexto en lib/utils.
const hoy = hoyTexto

const vacio = {
  fechaEjecucion: hoy(),
  /** La tarea asignada de la que nace esta obra. Vacio: obra sin tarea detras. */
  tareaId: '',
  proyectoId: '',
  torreId: '',
  pisoId: '',
  zonaId: '',
  frenteId: '',
  actividadId: '',
  cuadrillaId: '',
  trabajadorId: '',
  largo: '',
  alto: '',
  m2Ejecutados: '',
  horaInicio: '07:00',
  horaFinal: '17:00',
  tiempoRecesoMin: '60',
  m2Meta: '',
  observaciones: '',
}

/**
 * Abre una obra: el primer dia de trabajo sobre un elemento. Aqui se capturan
 * las medidas, que son contra lo que se mide el avance de toda la cadena.
 */
export function FormRegistroObra({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Registro | null
  onCerrar: () => void
  onGuardado: (creado: Registro) => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState(vacio)
  const [metaTocada, setMetaTocada] = useState(false)

  const cambiar = (campos: Partial<typeof vacio>) => setForm((f) => ({ ...f, ...campos }))

  /**
   * Un solo viaje para proyecto, torre, piso, zona, actividad y cuadrilla.
   *
   * Antes eran seis peticiones encadenadas: elegir el proyecto pedia sus
   * torres, elegir la torre pedia sus pisos, y asi hasta la zona. El residente
   * esperaba una ida y vuelta a la base entre un desplegable y el siguiente.
   * Ahora la jerarquia ya esta en memoria y encadenar es filtrar un array.
   *
   * Los frentes se quedan aparte a proposito: son la parte que crece con el
   * tamaño de la obra y solo hacen falta despues de elegir la zona.
   */
  const { dato: catalogos } = useRecursoUnico<Catalogos>(abierto ? '/api/catalogos' : null)
  const frentes = useRecurso<Frente>(
    abierto && form.zonaId ? `/api/frentes?zonaId=${form.zonaId}` : null,
  )
  const cuadrilla = useRecursoUnico<Cuadrilla>(
    abierto && form.cuadrillaId ? `/api/cuadrillas/${form.cuadrillaId}` : null,
  )

  /**
   * Las tareas que todavia no han dado lugar a una obra: son las que se pueden
   * elegir aqui. Una tarea da una sola obra, asi que en cuanto se registra
   * desaparece de la lista.
   */
  const tareas = useRecurso<Tarea>(abierto ? '/api/tareas?sinObra=1' : null)

  const proyectos = catalogos?.proyectos ?? []

  // Un registro nuevo solo puede usar catalogo vigente.
  const actividades = (catalogos?.actividades ?? []).filter((a) => a.activo)

  const torres = useMemo(
    () =>
      form.proyectoId
        ? (catalogos?.torres ?? []).filter((t) => t.proyectoId === Number(form.proyectoId))
        : [],
    [catalogos, form.proyectoId],
  )

  const pisos = useMemo(
    () =>
      form.torreId
        ? (catalogos?.pisos ?? []).filter((p) => p.torreId === Number(form.torreId))
        : [],
    [catalogos, form.torreId],
  )

  const zonas = useMemo(
    () =>
      form.pisoId ? (catalogos?.zonas ?? []).filter((z) => z.pisoId === Number(form.pisoId)) : [],
    [catalogos, form.pisoId],
  )

  const cuadrillas = useMemo(
    () =>
      form.proyectoId
        ? (catalogos?.cuadrillas ?? []).filter(
            (c) => c.activo && c.proyectoId === Number(form.proyectoId),
          )
        : [],
    [catalogos, form.proyectoId],
  )

  const integrantes = (cuadrilla.dato?.integrantes ?? []).filter((i) => i.activo)
  // Las opciones se escriben como en el panel: torre, piso, zona y cuadrilla
  // llevan detras el codigo de su proyecto.
  const etiquetas = useMemo(() => crearEtiquetas(catalogos), [catalogos])

  const trabajadorElegido = integrantes.find((i) => String(i.trabajadorId) === form.trabajadorId)

  /**
   * El precio de esta jornada: el que tiene ESE trabajador para ESA actividad.
   * Si no hay ninguno, la jornada se guarda igual pero sin importe, y conviene
   * decirlo antes de guardar y no al liquidar.
   */
  const tarifaJornada = form.actividadId
    ? (trabajadorElegido?.trabajador?.tarifas ?? []).find(
        (t) => t.actividadId === Number(form.actividadId),
      )
    : undefined
  const faltaTarifa = Boolean(form.trabajadorId && form.actividadId && !tarifaJornada)
  const cargoId = trabajadorElegido?.trabajador?.cargo.id ?? null

  /**
   * Heredar la tarea: se copian sus datos al formulario de una vez, incluida la
   * ubicacion completa, que se reconstruye desde el frente.
   *
   * Se copian, no se enlazan: si ese dia fue otra cuadrilla o el muro midio dos
   * centimetros menos, el residente lo corrige aqui y la tarea se queda como
   * estaba. Lo unico que la API exige que coincida es el frente y la actividad.
   */
  const heredarTarea = (tareaId: string) => {
    const tarea = tareas.datos.find((t) => String(t.id) === tareaId)
    if (!tarea) {
      cambiar({ tareaId: '' })
      return
    }
    const zona = tarea.frente?.zona
    cambiar({
      tareaId,
      proyectoId: zona ? String(zona.piso.torre.proyecto.id) : '',
      torreId: zona ? String(zona.piso.torre.id) : '',
      pisoId: zona ? String(zona.piso.id) : '',
      zonaId: zona ? String(zona.id) : '',
      frenteId: String(tarea.frenteId),
      actividadId: String(tarea.actividadId),
      cuadrillaId: tarea.cuadrillaId ? String(tarea.cuadrillaId) : '',
      trabajadorId: tarea.trabajadorId ? String(tarea.trabajadorId) : '',
      largo: String(tarea.largo),
      alto: String(tarea.alto),
      m2Meta: tarea.m2Meta === null ? '' : String(tarea.m2Meta),
    })
    // La meta viene de la tarea: no hay que volver a proponerla desde las metas
    // vigentes del proyecto.
    if (tarea.m2Meta !== null) setMetaTocada(true)
  }

  const tareaElegida = tareas.datos.find((t) => String(t.id) === form.tareaId)

  useEffect(() => {
    if (!abierto) return
    setMetaTocada(false)

    if (!registro) {
      setForm(vacio)
      return
    }

    const zona = registro.frente?.zona
    setForm({
      tareaId: registro.tareaId ? String(registro.tareaId) : '',
      fechaEjecucion: fechaParaInput(registro.fechaEjecucion),
      proyectoId: String(zona?.piso.torre.proyecto.id ?? ''),
      torreId: String(zona?.piso.torre.id ?? ''),
      pisoId: String(zona?.piso.id ?? ''),
      zonaId: String(zona?.id ?? ''),
      frenteId: String(registro.frenteId),
      actividadId: String(registro.actividadId),
      cuadrillaId: String(registro.cuadrillaId),
      trabajadorId: registro.trabajadorId ? String(registro.trabajadorId) : '',
      largo: registro.largo === null ? '' : String(registro.largo),
      alto: registro.alto === null ? '' : String(registro.alto),
      m2Ejecutados: String(registro.m2Ejecutados),
      horaInicio: dateAHora(registro.horaInicio),
      horaFinal: dateAHora(registro.horaFinal),
      tiempoRecesoMin: String(registro.tiempoRecesoMin),
      m2Meta: registro.m2Meta === null ? '' : String(registro.m2Meta),
      observaciones: registro.observaciones || '',
    })
  }, [abierto, registro])

  // La meta del dia se propone desde la meta vigente de la actividad.
  useEffect(() => {
    if (!abierto || metaTocada) return
    if (!form.proyectoId || !form.actividadId) return

    const parametros = new URLSearchParams({
      proyectoId: form.proyectoId,
      actividadId: form.actividadId,
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
  }, [abierto, metaTocada, form.proyectoId, form.actividadId, form.fechaEjecucion, cargoId])

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

    const area = (Number(form.largo) || 0) * (Number(form.alto) || 0)
    const hecho = Number(form.m2Ejecutados) || 0

    return {
      jornada,
      area,
      pendiente: Math.max(0, area - hecho),
      avance: area > 0 ? hecho / area : 0,
      completa: area > 0 && hecho >= area - 0.005,
      excedido: area > 0 && hecho > area + 0.005,
    }
  }, [form])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    const { proyectoId, torreId, pisoId, zonaId, ...datos } = form
    void [proyectoId, torreId, pisoId, zonaId]
    guardar(
      registro ? `/api/registros/${registro.id}` : '/api/registros',
      registro ? 'PUT' : 'POST',
      datos,
      (creado) => onGuardado(creado as Registro),
    )
  }

  return (
    <Modal
      titulo={registro ? `Editar registro ${registro.codigoRegistro}` : 'Nuevo registro de obra'}
      descripcion="El primer dia de trabajo sobre un elemento. Aqui van sus medidas."
      abierto={abierto}
      onCerrar={onCerrar}
      ancho="xl"
    >
      <form onSubmit={enviarFormulario} className="space-y-5">
        <AvisoError mensaje={errorGeneral} />

        {/* --- La tarea que se va a ejecutar ------------------------------- */}
        {!registro && (
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
              Tarea asignada
            </h3>
            <Campo etiqueta="Tarea" error={errores.tareaId}>
              <Seleccion value={form.tareaId} onChange={(e) => heredarTarea(e.target.value)}>
                <option value="">Sin tarea: se captura a mano</option>
                {tareas.datos.map((t) => {
                  const zona = t.frente?.zona
                  return (
                    <option key={t.id} value={t.id}>
                      {t.codigo} · {t.actividad?.nombre} · {t.frente?.codigoDwg}
                      {zona
                        ? ` ${zona.nombre} (${zona.piso.torre.nombre} - ${zona.piso.torre.proyecto.codigo})`
                        : ''}
                    </option>
                  )
                })}
              </Seleccion>
              <p className="mt-1.5 text-xs text-obra-500">
                {tareaElegida
                  ? 'Los datos de la tarea ya estan abajo. Si ese dia cambio algo, corrigelo: la tarea se queda como esta.'
                  : 'Elegir una tarea rellena ubicacion, actividad, personal, medidas y meta. Tambien se puede abrir obra sin tarea.'}
              </p>
            </Campo>
          </section>
        )}

        {registro?.tarea && (
          <p className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2 text-xs text-obra-600">
            Esta obra nacio de la tarea {registro.tarea.codigo}.
          </p>
        )}

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
            Ubicacion
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Fecha de ejecucion" error={errores.fechaEjecucion} requerido>
              <Entrada
                type="date"
                value={form.fechaEjecucion}
                onChange={(e) => cambiar({ fechaEjecucion: e.target.value })}
                required
              />
            </Campo>

            <Campo etiqueta="Proyecto" requerido>
              <Seleccion
                value={form.proyectoId}
                onChange={(e) =>
                  cambiar({
                    proyectoId: e.target.value,
                    torreId: '',
                    pisoId: '',
                    zonaId: '',
                    frenteId: '',
                    cuadrillaId: '',
                    trabajadorId: '',
                  })
                }
                required
              >
                <option value="">Selecciona...</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} - {p.nombre}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <Campo etiqueta="Torre" requerido>
              <Seleccion
                value={form.torreId}
                onChange={(e) =>
                  cambiar({ torreId: e.target.value, pisoId: '', zonaId: '', frenteId: '' })
                }
                disabled={!form.proyectoId}
                required
              >
                <option value="">Selecciona...</option>
                {torres.map((t) => (
                  <option key={t.id} value={t.id}>
                    {etiquetas.torre(t)}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <Campo etiqueta="Piso" requerido>
              <Seleccion
                value={form.pisoId}
                onChange={(e) => cambiar({ pisoId: e.target.value, zonaId: '', frenteId: '' })}
                disabled={!form.torreId}
                required
              >
                <option value="">Selecciona...</option>
                {pisos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetas.piso(p)}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <Campo etiqueta="Zona" requerido>
              <Seleccion
                value={form.zonaId}
                onChange={(e) => cambiar({ zonaId: e.target.value, frenteId: '' })}
                disabled={!form.pisoId}
                required
              >
                <option value="">Selecciona...</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {etiquetas.zona(z)}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <Campo etiqueta="Frente de trabajo" error={errores.frenteId} requerido>
              <Seleccion
                value={form.frenteId}
                onChange={(e) => cambiar({ frenteId: e.target.value })}
                disabled={!form.zonaId}
                required
              >
                <option value="">Selecciona...</option>
                {frentes.datos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.codigoDwg} - {f.descripcion}
                  </option>
                ))}
              </Seleccion>
            </Campo>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
            Actividad y personal
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Actividad" error={errores.actividadId} requerido>
              <Seleccion
                value={form.actividadId}
                onChange={(e) => cambiar({ actividadId: e.target.value })}
                required
              >
                <option value="">Selecciona...</option>
                {actividades.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <Campo etiqueta="Cuadrilla" error={errores.cuadrillaId} requerido>
              <Seleccion
                value={form.cuadrillaId}
                onChange={(e) => cambiar({ cuadrillaId: e.target.value, trabajadorId: '' })}
                disabled={!form.proyectoId}
                required
              >
                <option value="">Selecciona...</option>
                {cuadrillas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {etiquetas.cuadrilla(c)}
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
                ` · ${formatoMoneda(tarifaJornada.valorM2)} por unidad en esta actividad`}
            </p>
          )}

          {faltaTarifa && (
            <p className="mt-2 rounded-lg border border-acento-200 bg-acento-50 px-3 py-2 text-xs text-acento-800">
              {trabajadorElegido?.trabajador?.nombre ?? 'Este trabajador'} no tiene precio
              acordado para esta actividad, asi que la jornada se guardara sin importe. Se
              arregla en su ficha, en la seccion Trabajadores.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
            Medidas del elemento y trabajo del dia
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etiqueta="Largo (m)" error={errores.largo} requerido>
              <Entrada
                type="number"
                step="0.01"
                min="0.01"
                value={form.largo}
                onChange={(e) => cambiar({ largo: e.target.value })}
                placeholder="12.00"
                required
              />
            </Campo>
            <Campo etiqueta="Alto (m)" error={errores.alto} requerido>
              <Entrada
                type="number"
                step="0.01"
                min="0.01"
                value={form.alto}
                onChange={(e) => cambiar({ alto: e.target.value })}
                placeholder="2.70"
                required
              />
            </Campo>
            <Campo etiqueta="m2 ejecutados hoy" error={errores.m2Ejecutados} requerido>
              <Entrada
                type="number"
                step="0.01"
                min="0.01"
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
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
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

          {vista?.excedido && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Lo ejecutado no puede superar los {formatoNumero(vista.area)} m2 del elemento.
            </p>
          )}
        </section>

        {vista && (
          <section className="rounded-xl border border-acento-200 bg-acento-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-acento-800">
              Calculado automaticamente
            </h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ['m2 del elemento', formatoNumero(vista.area)],
                ['m2 pendientes', formatoNumero(vista.pendiente)],
                ['Tiempo efectivo', formatoDuracion(vista.jornada.minutosEfectivos)],
                [
                  'Rendimiento',
                  vista.jornada.rendimiento === null
                    ? '-'
                    : `${formatoNumero(vista.jornada.rendimiento)} m2/h`,
                ],
                ['Cumplimiento', formatoPorcentaje(vista.jornada.cumplimiento)],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                  <dt className="text-xs text-acento-800">{etiqueta}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-obra-900">{valor}</dd>
                </div>
              ))}
            </dl>

            {vista.area > 0 && (
              <div className="mt-4 border-t border-acento-200 pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-acento-800">Avance de la obra</span>
                  <span className="text-sm font-semibold tabular-nums text-obra-900">
                    {formatoPorcentaje(Math.min(1, vista.avance))}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-acento-200">
                  <div
                    className={
                      vista.completa
                        ? 'h-full rounded-full bg-emerald-500'
                        : 'h-full rounded-full bg-acento-500'
                    }
                    style={{ width: `${Math.min(100, vista.avance * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-acento-800">
                  {vista.completa
                    ? 'La obra queda terminada con este solo registro.'
                    : `Quedarian ${formatoNumero(vista.pendiente)} m2, que se cargan despues como registros de avance.`}
                </p>
              </div>
            )}
          </section>
        )}

        <Campo etiqueta="Observaciones" error={errores.observaciones}>
          <AreaTexto
            value={form.observaciones}
            onChange={(e) => cambiar({ observaciones: e.target.value })}
            placeholder="Novedades del dia, retrasos, material faltante..."
          />
        </Campo>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} error={errorGeneral} />
      </form>
    </Modal>
  )
}
