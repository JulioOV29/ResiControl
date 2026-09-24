'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion, AreaTexto } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { useRecurso, useRecursoUnico } from '@/lib/cliente'
import { crearEtiquetas } from '@/lib/etiquetas'
import { fechaParaInput, formatoNumero, hoyTexto } from '@/lib/utils'
import { opcionesEstadoEjecucion } from '@/lib/dominio'
import type { Catalogos, Cuadrilla, Elemento, Tarea } from '@/types/dominio'

/**
 * Asignar una tarea: el trabajo que se encarga antes de ejecutarlo.
 *
 * Pide los mismos datos con los que luego se registra la jornada, porque es
 * justo lo que el registro va a heredar: donde, que actividad, quien lo hace,
 * para cuando y con que meta. Las medidas no se piden: son las del elemento
 * constructivo, que es donde se miden una sola vez.
 *
 * La ubicacion se elige bajando por la jerarquia (proyecto, torre, piso, zona,
 * elemento) igual que en el registro de obra, con la misma jerarquia ya en
 * memoria: encadenar es filtrar un array, no una peticion por desplegable.
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
  fechaInicioPlan: hoyTexto(),
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
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState(vacio)

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

  useEffect(() => {
    if (!abierto) return
    if (!registro) {
      setForm(vacio)
      return
    }
    // Al editar, la ubicacion se reconstruye de abajo hacia arriba desde el
    // elemento, que es lo unico que guarda la tarea.
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

  // Las medidas no se teclean aqui: son las del elemento constructivo, que es
  // donde se miden una sola vez. La tarea solo dice que hay que hacerlo.
  const elementoElegido = elementos.datos.find((f) => String(f.id) === form.elementoId)

  const area = elementoElegido ? elementoElegido.largo * elementoElegido.alto : 0

  // La obra ya arranco: la ubicacion, la actividad y las medidas quedan fijas,
  // porque lo ejecutado se midio contra ellas.
  const obraIniciada = Boolean(registro?.registro)

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
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
      onCerrar={onCerrar}
      ancho="lg"
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        {obraIniciada && (
          <p className="rounded-lg border border-marca-200 bg-marca-50 px-3 py-2 text-xs text-marca-700">
            De esta tarea ya nacio la obra {registro?.registro?.codigoRegistro}. El elemento y la
            actividad ya no se cambian aqui. Lo demas si se puede ajustar.
          </p>
        )}

        {/* --- Que y donde -------------------------------------------------- */}
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

        {/* --- Cuanto ------------------------------------------------------- */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-obra-500">
            Cantidad por ejecutar
          </p>
          <div className="grid items-end gap-4 sm:grid-cols-2">
            {/*
              Las medidas llegan heredadas del elemento constructivo y no se
              teclean aqui: un muro se mide una vez, al darlo de alta. Si estan
              mal, se corrigen en la ficha del elemento.
            */}
            <div className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2">
              <p className="text-xs text-obra-500">Area del elemento</p>
              {elementoElegido ? (
                <>
                  <p className="text-lg font-semibold tabular-nums text-obra-900">
                    {formatoNumero(area)}{' '}
                    <span className="text-sm font-normal text-obra-500">
                      {elementoElegido.unidad || 'm2'}
                    </span>
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

            <Campo etiqueta="m2 meta por jornada" error={errores.m2Meta}>
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

        {/* --- A quien y para cuando ---------------------------------------- */}
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
                {integrantes.map((i) => (
                  <option key={i.id} value={i.trabajadorId}>
                    {i.trabajador?.apellido} {i.trabajador?.nombre}
                  </option>
                ))}
              </Seleccion>
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
                {opcionesEstadoEjecucion.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.texto}
                  </option>
                ))}
              </Seleccion>
              <p className="mt-1 text-xs text-obra-400">
                Se mueve solo cuando se registra ejecucion. Suspendido es el unico que manda sobre
                el avance.
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

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
