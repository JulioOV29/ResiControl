'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion, AreaTexto } from '@/components/ui/input'
import { AvisoError, Pasos, PiePasos, VentanaError, useEnvio } from './base'
import { useRecurso, useRecursoUnico } from '@/lib/cliente'
import { crearEtiquetas } from '@/lib/etiquetas'
import { fechaParaInput, formatoNumero, hoyTexto } from '@/lib/utils'
import { ETIQUETA_ESTADO_EJECUCION, cantidadDelElemento } from '@/lib/dominio'
import type { Catalogos, Cuadrilla, Elemento, Tarea } from '@/types/dominio'

/** true si el trabajador tiene precio para esa actividad. */
function tienePrecio(
  trabajador: { tarifas?: Array<{ actividadId: number }> } | undefined | null,
  actividadId: string | number | null | undefined,
) {
  if (!actividadId) return true
  return (trabajador?.tarifas ?? []).some((t) => t.actividadId === Number(actividadId))
}

/**
 * Asignar una tarea: el trabajo que se encarga antes de ejecutarlo.
 * El registro de obra hereda estos datos. Las medidas son las del elemento.
 */
const vacio = {
  proyectoId: '',
  torreId: '',
  pisoId: '',
  zonaId: '',
  elementoId: '',
  actividadId: '',
  cuadrillaId: '',
  trabajadorId: '',
  m2Meta: '',
  // Se pone al abrir el formulario (no al cargar la pagina).
  fechaInicioPlan: '',
  fechaFinPlan: '',
  estado: 'PENDIENTE',
  observaciones: '',
}

export function FormTarea({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Tarea | null
  onCerrar: () => void
  onGuardado: () => void
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

  /** Dos pasos: primero que y donde; asi la meta se pide en la unidad correcta. */
  const [paso, setPaso] = useState(1)

  const cambiar = (campos: Partial<typeof vacio>) => setForm((f) => ({ ...f, ...campos }))

  const { dato: catalogos } = useRecursoUnico<Catalogos>(abierto ? '/api/catalogos' : null)
  const elementos = useRecurso<Elemento>(
    abierto && form.zonaId ? `/api/elementos?zonaId=${form.zonaId}` : null,
  )
  const cuadrilla = useRecursoUnico<Cuadrilla>(
    abierto && form.cuadrillaId ? `/api/cuadrillas/${form.cuadrillaId}` : null,
  )

  const etiquetas = useMemo(() => crearEtiquetas(catalogos), [catalogos])

  const proyectos = catalogos?.proyectos ?? []
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
      form.torreId ? (catalogos?.pisos ?? []).filter((p) => p.torreId === Number(form.torreId)) : [],
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
            (c) => c.proyectoId === Number(form.proyectoId) && c.activo,
          )
        : [],
    [catalogos, form.proyectoId],
  )

  const integrantes = (cuadrilla.dato?.integrantes ?? []).filter((i) => i.activo)
  const trabajadorElegido = integrantes.find((i) => String(i.trabajadorId) === form.trabajadorId)
  /** El trabajador elegido no tiene precio para la actividad. */
  const faltaTarifa = Boolean(
    form.trabajadorId &&
      form.actividadId &&
      trabajadorElegido &&
      !tienePrecio(trabajadorElegido.trabajador, form.actividadId),
  )

  useEffect(() => {
    if (!abierto) return
    setPaso(1)
    if (!registro) {
      setForm({ ...vacio, fechaInicioPlan: hoyTexto() })
      return
    }
    // Al editar, la ubicacion se reconstruye desde el elemento.
    const zona = registro.elemento?.zona
    setForm({
      proyectoId: zona ? String(zona.piso.torre.proyecto.id) : '',
      torreId: zona ? String(zona.piso.torre.id) : '',
      pisoId: zona ? String(zona.piso.id) : '',
      zonaId: zona ? String(zona.id) : '',
      elementoId: String(registro.elementoId),
      actividadId: String(registro.actividadId),
      cuadrillaId: registro.cuadrillaId ? String(registro.cuadrillaId) : '',
      trabajadorId: registro.trabajadorId ? String(registro.trabajadorId) : '',
      m2Meta: registro.m2Meta === null ? '' : String(registro.m2Meta),
      fechaInicioPlan: fechaParaInput(registro.fechaInicioPlan),
      fechaFinPlan: fechaParaInput(registro.fechaFinPlan),
      estado: registro.estado,
      observaciones: registro.observaciones || '',
    })
  }, [abierto, registro])

  const elementoElegido = elementos.datos.find((f) => String(f.id) === form.elementoId)

  /** Estado que da el avance (el que tenia, o Pendiente si estaba suspendida o es nueva). */
  const estadoAutomatico =
    registro && registro.estado !== 'SUSPENDIDO' ? registro.estado : 'PENDIENTE'

  /** Unidad de la actividad: m2, ml, und... */
  const unidad =
    actividades.find((a) => String(a.id) === form.actividadId)?.unidadMedida ??
    // Al editar, la actividad puede estar inactiva: se usa la de la tarea.
    (registro && String(registro.actividadId) === form.actividadId
      ? registro.actividad?.unidadMedida
      : undefined) ??
    'm2'

  /** El paso 1 esta completo con elemento y actividad. */
  const listoPaso1 = Boolean(form.elementoId && form.actividadId)

  /**
   * Cantidad por ejecutar: m2 = largo x alto, ml = largo.
   * En und, m3 o kg es null (se escribe al abrir la obra).
   */
  const cantidad = elementoElegido
    ? cantidadDelElemento(
        unidad,
        elementoElegido.largo,
        elementoElegido.alto,
        elementoElegido.areaVanos,
      )
    : null

  // Si la obra ya empezo, ubicacion y actividad no se cambian.
  const obraIniciada = Boolean(registro?.registro)

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    // Enter en el paso 1 avanza, no guarda.
    if (paso < 2) {
      if (listoPaso1) setPaso(2)
      return
    }
    // Si el envio vino de un boton que no es Guardar, solo se cambio de paso.
    const boton = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (boton && boton.type !== 'submit') return
    // Sin precio no se guarda (al editar, solo si cambia trabajador o actividad).
    const cambiaQuienOQue =
      !registro ||
      form.trabajadorId !== String(registro.trabajadorId ?? '') ||
      form.actividadId !== String(registro.actividadId)
    if (cambiaQuienOQue && faltaTarifa) {
      const actividad = catalogos?.actividades.find((a) => String(a.id) === form.actividadId)?.nombre
      mostrarVentanaError(
        `${trabajadorElegido?.trabajador?.nombre ?? 'El trabajador'} ${trabajadorElegido?.trabajador?.apellido ?? ''} no tiene precio acordado para ${actividad ?? 'esta actividad'}. Acuerda el precio en su ficha (Trabajadores) y vuelve a asignar la tarea.`,
      )
      return
    }
    const { proyectoId, torreId, pisoId, zonaId, ...datos } = form
    void [proyectoId, torreId, pisoId, zonaId]
    guardar(
      registro ? `/api/tareas/${registro.id}` : '/api/tareas',
      registro ? 'PUT' : 'POST',
      datos,
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? `Editar tarea ${registro.codigo}` : 'Asignar tarea'}
      descripcion="El trabajo que se encarga. El registro de obra hereda estos datos cuando se ejecuta."
      abierto={abierto}
      // Con la ventana de error abierta, Escape solo la cierra a ella.
      onCerrar={ventanaError ? cerrarVentanaError : onCerrar}
      ancho="lg"
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <Pasos actual={paso} titulos={['Trabajo y ubicacion', 'Asignacion y meta']} />

        {obraIniciada && (
          <p className="rounded-lg border border-marca-200 bg-marca-50 px-3 py-2 text-xs text-marca-700">
            De esta tarea ya nacio la obra {registro?.registro?.codigoRegistro}. El elemento y la
            actividad ya no se cambian aqui. Lo demas si se puede ajustar.
          </p>
        )}

        {/* --- Paso 1: que y donde --- */}
        {paso === 1 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-obra-500">
            Trabajo y ubicacion
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Proyecto" requerido>
              <Seleccion
                value={form.proyectoId}
                onChange={(e) =>
                  cambiar({
                    proyectoId: e.target.value,
                    torreId: '',
                    pisoId: '',
                    zonaId: '',
                    elementoId: '',
                    cuadrillaId: '',
                    trabajadorId: '',
                  })
                }
                disabled={obraIniciada}
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
                  cambiar({ torreId: e.target.value, pisoId: '', zonaId: '', elementoId: '' })
                }
                disabled={obraIniciada || !form.proyectoId}
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
                onChange={(e) => cambiar({ pisoId: e.target.value, zonaId: '', elementoId: '' })}
                disabled={obraIniciada || !form.torreId}
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
                onChange={(e) => cambiar({ zonaId: e.target.value, elementoId: '' })}
                disabled={obraIniciada || !form.pisoId}
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

            <Campo etiqueta="Elemento constructivo" error={errores.elementoId} requerido>
              <Seleccion
                value={form.elementoId}
                onChange={(e) => cambiar({ elementoId: e.target.value })}
                disabled={obraIniciada || !form.zonaId}
                required
              >
                <option value="">Selecciona...</option>
                {elementos.datos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.codigoDwg} - {f.descripcion}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <Campo etiqueta="Actividad" error={errores.actividadId} requerido>
              <Seleccion
                value={form.actividadId}
                onChange={(e) => cambiar({ actividadId: e.target.value })}
                disabled={obraIniciada}
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
          </div>
        </section>
        )}

        {/* --- Paso 2: cuanto, a quien y para cuando --- */}
        {paso === 2 && (
        <>
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-obra-500">
            Cantidad por ejecutar
          </p>
          <div className="grid items-end gap-4 sm:grid-cols-2">
            {/* Medidas del elemento (se corrigen en su ficha) */}
            <div className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2">
              <p className="text-xs text-obra-500">Cantidad por ejecutar</p>
              {elementoElegido ? (
                <>
                  <p className="text-lg font-semibold tabular-nums text-obra-900">
                    {cantidad === null ? (
                      <span className="text-sm font-normal text-obra-500">
                        En {unidad} se escribe al abrir la obra
                      </span>
                    ) : (
                      <>
                        {formatoNumero(cantidad)}{' '}
                        <span className="text-sm font-normal text-obra-500">{unidad}</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs tabular-nums text-obra-500">
                    {formatoNumero(elementoElegido.largo)} x {formatoNumero(elementoElegido.alto)} m
                    · se miden en la ficha del elemento
                  </p>
                </>
              ) : (
                <p className="text-sm text-obra-400">Elige el elemento constructivo</p>
              )}
            </div>

            <Campo etiqueta={`${unidad} meta por jornada`} error={errores.m2Meta}>
              <Entrada
                type="number"
                step="0.01"
                min="0"
                value={form.m2Meta}
                onChange={(e) => cambiar({ m2Meta: e.target.value })}
                placeholder="Sin meta"
              />
            </Campo>
          </div>
        </section>

        {/* --- A quien y para cuando --- */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-obra-500">
            Asignacion y plazo
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etiqueta="Cuadrilla" error={errores.cuadrillaId}>
              <Seleccion
                value={form.cuadrillaId}
                onChange={(e) => cambiar({ cuadrillaId: e.target.value, trabajadorId: '' })}
                disabled={!form.proyectoId}
              >
                <option value="">Sin asignar</option>
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
                {integrantes.map((i) => {
                  // Sin precio para la actividad no se puede elegir.
                  const sinPrecio = Boolean(form.actividadId) && !tienePrecio(i.trabajador, form.actividadId)
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
              {faltaTarifa && (
                <p className="mt-1 text-xs text-red-600">
                  Sin precio acordado para esta actividad: acuerdalo primero en su ficha.
                </p>
              )}
            </Campo>

            <Campo etiqueta="Inicio previsto" error={errores.fechaInicioPlan}>
              <Entrada
                type="date"
                value={form.fechaInicioPlan}
                onChange={(e) => cambiar({ fechaInicioPlan: e.target.value })}
              />
            </Campo>

            <Campo etiqueta="Fin previsto" error={errores.fechaFinPlan}>
              <Entrada
                type="date"
                value={form.fechaFinPlan}
                min={form.fechaInicioPlan || undefined}
                onChange={(e) => cambiar({ fechaFinPlan: e.target.value })}
              />
            </Campo>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Estado" error={errores.estado} requerido>
              <Seleccion
                value={form.estado}
                onChange={(e) => cambiar({ estado: e.target.value })}
                required
              >
                <option value={estadoAutomatico}>
                  {ETIQUETA_ESTADO_EJECUCION[estadoAutomatico]} (segun el avance)
                </option>
                <option value="SUSPENDIDO">{ETIQUETA_ESTADO_EJECUCION.SUSPENDIDO}</option>
              </Seleccion>
              <p className="mt-1 text-xs text-obra-400">
                El estado se mueve solo con los registros de obra. A mano solo se suspende o se
                reactiva.
              </p>
            </Campo>

            <Campo etiqueta="Observaciones" error={errores.observaciones}>
              <AreaTexto
                value={form.observaciones}
                onChange={(e) => cambiar({ observaciones: e.target.value })}
                placeholder="Instrucciones para el residente"
              />
            </Campo>
          </div>
        </section>

        </>
        )}

        <PiePasos
          paso={paso}
          total={2}
          enviando={enviando}
          puedeSeguir={listoPaso1}
          onCancelar={onCerrar}
          onAtras={() => setPaso(1)}
          onSiguiente={() => setPaso(2)}
        />
      </form>
      <VentanaError mensaje={ventanaError} onCerrar={cerrarVentanaError} />
    </Modal>
  )
}
