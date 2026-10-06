'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion, AreaTexto } from '@/components/ui/input'
import { AvisoError, Pasos, PiePasos, VentanaError, useEnvio } from './base'
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
import { cantidadDelElemento, modoCantidad } from '@/lib/dominio'
import type { Catalogos, Cuadrilla, Elemento, Meta, Obra, Registro, Tarea } from '@/types/dominio'

// Fecha local, no UTC (ver hoyTexto).
const hoy = hoyTexto

/** true si el trabajador tiene precio para esa actividad. */
function tienePrecio(
  trabajador: { tarifas?: Array<{ actividadId: number }> } | undefined | null,
  actividadId: string | number | null | undefined,
) {
  if (!actividadId) return true
  return (trabajador?.tarifas ?? []).some((t) => t.actividadId === Number(actividadId))
}

// La fecha se pone al abrir el formulario (no al cargar la pagina).
const vacio = {
  fechaEjecucion: '',
  /** Tarea de la que nace la obra ('' = sin tarea). */
  tareaId: '',
  proyectoId: '',
  torreId: '',
  pisoId: '',
  zonaId: '',
  elementoId: '',
  actividadId: '',
  cuadrillaId: '',
  trabajadorId: '',
  m2Ejecutados: '',
  /** Solo se escribe en und, m3 y kg. */
  cantidadTotal: '',
  horaInicio: '07:00',
  horaFinal: '17:00',
  tiempoRecesoMin: '60',
  m2Meta: '',
  observaciones: '',
}

/** Abre una obra: el primer dia de trabajo sobre un elemento. */
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
  /** Dos pasos: primero que y donde, luego el resto (la unidad depende de la actividad). */
  const [paso, setPaso] = useState(1)

  const cambiar = (campos: Partial<typeof vacio>) => setForm((f) => ({ ...f, ...campos }))

  /** Todos los catalogos en una peticion; los elementos se piden al elegir la zona. */
  const { dato: catalogos } = useRecursoUnico<Catalogos>(abierto ? '/api/catalogos' : null)
  const elementos = useRecurso<Elemento>(
    abierto && form.zonaId ? `/api/elementos?zonaId=${form.zonaId}` : null,
  )
  const cuadrilla = useRecursoUnico<Cuadrilla>(
    abierto && form.cuadrillaId ? `/api/cuadrillas/${form.cuadrillaId}` : null,
  )

  /** Al editar una apertura con avances: la obra, para descontar lo que ya llevan. */
  const obraEditada = useRecurso<Obra>(
    abierto && registro?.continuacion
      ? `/api/obras?elementoId=${registro.elementoId}&actividadId=${registro.actividadId}`
      : null,
  )
  const ejecutadoAvances = useMemo(() => {
    if (!registro) return 0
    const obra = obraEditada.datos.find((o) => o.id === registro.id)
    return obra ? Math.max(0, obra.resumen.ejecutado - registro.m2Ejecutados) : 0
  }, [obraEditada.datos, registro])

  /** Tareas que aun no tienen obra. */
  const tareas = useRecurso<Tarea>(abierto ? '/api/tareas?sinObra=1' : null)

  const proyectos = catalogos?.proyectos ?? []

  // Un registro nuevo solo usa actividades activas.
  const actividades = (catalogos?.actividades ?? []).filter((a) => a.activo)

  /**
   * Unidad de la actividad. Al editar, puede venir del propio registro
   * (si la actividad ya no esta activa).
   */
  const unidad =
    actividades.find((a) => String(a.id) === form.actividadId)?.unidadMedida ??
    registro?.actividad?.unidadMedida ??
    'm2'

  /** El paso 2 se habilita cuando hay fecha, elemento y actividad. */
  const listoPaso1 = Boolean(form.fechaEjecucion && form.elementoId && form.actividadId)

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
  const etiquetas = useMemo(() => crearEtiquetas(catalogos), [catalogos])

  const trabajadorElegido = integrantes.find((i) => String(i.trabajadorId) === form.trabajadorId)

  /** Precio del trabajador para esta actividad. */
  const tarifaJornada = form.actividadId
    ? (trabajadorElegido?.trabajador?.tarifas ?? []).find(
        (t) => t.actividadId === Number(form.actividadId),
      )
    : undefined
  // Solo con el trabajador ya cargado: mientras carga la cuadrilla no se sabe.
  const faltaTarifa = Boolean(form.actividadId && trabajadorElegido && !tarifaJornada)
  const cargoId = trabajadorElegido?.trabajador?.cargo.id ?? null

  /**
   * Copia los datos de la tarea al formulario (se pueden corregir).
   * La API solo exige que coincidan elemento y actividad.
   */
  const heredarTarea = (tareaId: string) => {
    const tarea = tareas.datos.find((t) => String(t.id) === tareaId)
    if (!tarea) {
      cambiar({ tareaId: '' })
      return
    }
    const zona = tarea.elemento?.zona
    cambiar({
      tareaId,
      proyectoId: zona ? String(zona.piso.torre.proyecto.id) : '',
      torreId: zona ? String(zona.piso.torre.id) : '',
      pisoId: zona ? String(zona.piso.id) : '',
      zonaId: zona ? String(zona.id) : '',
      elementoId: String(tarea.elementoId),
      actividadId: String(tarea.actividadId),
      cuadrillaId: tarea.cuadrillaId ? String(tarea.cuadrillaId) : '',
      trabajadorId: tarea.trabajadorId ? String(tarea.trabajadorId) : '',
      m2Meta: tarea.m2Meta === null ? '' : String(tarea.m2Meta),
    })
    // La meta viene de la tarea.
    if (tarea.m2Meta !== null) setMetaTocada(true)
  }

  const tareaElegida = tareas.datos.find((t) => String(t.id) === form.tareaId)

  /** Si el elemento o la actividad ya no son los de la tarea elegida, se suelta la tarea. */
  const soltarTarea = (campo: 'elementoId' | 'actividadId', valor: string) =>
    tareaElegida && String(tareaElegida[campo]) !== valor ? { tareaId: '' } : {}

  // Si el servidor rechaza un dato del paso 1, se vuelve a ese paso para verlo.
  useEffect(() => {
    if (errores.fechaEjecucion || errores.elementoId || errores.actividadId || errores.tareaId) {
      setPaso(1)
    }
  }, [errores])

  /** Medidas del elemento. Al editar, si no hay elemento cargado, las del registro. */
  const elementoElegido = elementos.datos.find((f) => String(f.id) === form.elementoId)
  /** Al editar el mismo trabajo, la obra conserva la cantidad con que se abrio. */
  const conservaCantidad = Boolean(
    registro &&
      form.elementoId === String(registro.elementoId) &&
      form.actividadId === String(registro.actividadId) &&
      registro.cantidadTotal !== null,
  )
  const medidasElemento = conservaCantidad
    ? {
        largo: Number(registro!.largo) || 0,
        alto: Number(registro!.alto) || 0,
        // Vanos que tenia el elemento cuando se abrio la obra.
        areaVanos: Math.max(
          0,
          Math.round(
            ((Number(registro!.largo) || 0) * (Number(registro!.alto) || 0) -
              Number(registro!.cantidadTotal)) *
              100,
          ) / 100,
        ),
      }
    : {
        largo: elementoElegido?.largo ?? (registro?.largo || 0),
        alto: elementoElegido?.alto ?? (registro?.alto || 0),
        areaVanos: elementoElegido?.areaVanos ?? 0,
      }

  /**
   * Cantidad total de la obra: m2 = largo x alto menos vanos, ml = largo,
   * und/m3/kg = la escribe el residente. El servidor aplica la misma regla.
   */
  const modo = modoCantidad(unidad)
  const cantidadObra =
    modo === 'captura'
      ? Number(form.cantidadTotal) || 0
      : conservaCantidad
        ? Number(registro!.cantidadTotal)
        : (cantidadDelElemento(
          unidad,
          medidasElemento.largo,
          medidasElemento.alto,
          medidasElemento.areaVanos,
        ) ?? 0)

  useEffect(() => {
    if (!abierto) return
    // Al editar se respeta la meta que ya tenia la jornada.
    setMetaTocada(Boolean(registro))
    setPaso(1)

    if (!registro) {
      setForm({ ...vacio, fechaEjecucion: hoy() })
      return
    }

    const zona = registro.elemento?.zona
    setForm({
      tareaId: registro.tareaId ? String(registro.tareaId) : '',
      fechaEjecucion: fechaParaInput(registro.fechaEjecucion),
      proyectoId: String(zona?.piso.torre.proyecto.id ?? ''),
      torreId: String(zona?.piso.torre.id ?? ''),
      pisoId: String(zona?.piso.id ?? ''),
      zonaId: String(zona?.id ?? ''),
      elementoId: String(registro.elementoId),
      actividadId: String(registro.actividadId),
      cuadrillaId: String(registro.cuadrillaId),
      trabajadorId: registro.trabajadorId ? String(registro.trabajadorId) : '',
      m2Ejecutados: String(registro.m2Ejecutados),
      cantidadTotal: registro.cantidadTotal === null ? '' : String(registro.cantidadTotal),
      horaInicio: dateAHora(registro.horaInicio),
      horaFinal: dateAHora(registro.horaFinal),
      tiempoRecesoMin: String(registro.tiempoRecesoMin),
      m2Meta: registro.m2Meta === null ? '' : String(registro.m2Meta),
      observaciones: registro.observaciones || '',
    })
  }, [abierto, registro])

  // Propone la meta vigente de la actividad.
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
    // Mientras el usuario no escriba la meta, sigue a la meta vigente.
    pedir<Meta | null>(`/api/metas/vigente?${parametros}`).then((r) => {
      if (cancelado || !r.ok) return
      const propuesta = r.datos?.m2Objetivo ? String(r.datos.m2Objetivo) : ''
      setForm((f) => (f.m2Meta === propuesta ? f : { ...f, m2Meta: propuesta }))
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
      // Vacio = sin meta (no cuenta para el cumplimiento).
      m2Meta: form.m2Meta,
      horaInicio: horaADate(form.horaInicio),
      horaFinal: horaADate(form.horaFinal),
      tiempoRecesoMin: Number(form.tiempoRecesoMin) || 0,
    })

    const area = cantidadObra
    // Al editar, cuenta tambien lo que llevan los avances.
    const hecho = (Number(form.m2Ejecutados) || 0) + ejecutadoAvances

    return {
      jornada,
      area,
      pendiente: Math.max(0, area - hecho),
      avance: area > 0 ? hecho / area : 0,
      completa: area > 0 && hecho >= area - 0.005,
      excedido: area > 0 && hecho > area + 0.005,
    }
  }, [form, cantidadObra, ejecutadoAvances])

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
    if (vista?.excedido) {
      mostrarVentanaError(
        `Lo ejecutado no puede superar los ${formatoNumero(vista.area)} ${unidad} de la obra.`,
      )
      return
    }
    // Sin precio no se guarda (al editar, solo si cambia trabajador o actividad).
    const cambiaQuienOQue =
      !registro ||
      form.trabajadorId !== String(registro.trabajadorId ?? '') ||
      form.actividadId !== String(registro.actividadId)
    if (cambiaQuienOQue && faltaTarifa) {
      const actividad = actividades.find((a) => String(a.id) === form.actividadId)?.nombre
      mostrarVentanaError(
        `${trabajadorElegido?.trabajador?.nombre ?? 'El trabajador'} ${trabajadorElegido?.trabajador?.apellido ?? ''} no tiene precio acordado para ${actividad ?? 'esta actividad'}. Acuerda el precio en su ficha (Trabajadores) y vuelve a guardar.`,
      )
      return
    }
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
      // Con la ventana de error abierta, Escape solo la cierra a ella.
      onCerrar={ventanaError ? cerrarVentanaError : onCerrar}
      ancho="xl"
    >
      <form onSubmit={enviarFormulario} className="space-y-5">
        <AvisoError mensaje={errorGeneral} />

        <Pasos actual={paso} titulos={['Trabajo y ubicacion', 'Personal y jornada']} />

        {/* --- Paso 1: que, donde y cuando --- */}
        {paso === 1 && (
        <>
        {/* Tarea */}
        {!registro && (
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
              Tarea asignada
            </h3>
            <Campo etiqueta="Tarea" error={errores.tareaId}>
              <Seleccion value={form.tareaId} onChange={(e) => heredarTarea(e.target.value)}>
                <option value="">Sin tarea: se captura a mano</option>
                {tareas.datos.map((t) => {
                  const zona = t.elemento?.zona
                  return (
                    <option key={t.id} value={t.id}>
                      {t.codigo} · {t.actividad?.nombre} · {t.elemento?.codigoDwg}
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
            Trabajo y ubicacion
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Fecha de ejecucion" error={errores.fechaEjecucion} requerido>
              <Entrada
                type="date"
                value={form.fechaEjecucion}
                max={hoy()}
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
                    elementoId: '',
                    cuadrillaId: '',
                    trabajadorId: '',
                    tareaId: '',
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
                  cambiar({ torreId: e.target.value, pisoId: '', zonaId: '', elementoId: '', tareaId: '' })
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
                onChange={(e) => cambiar({ pisoId: e.target.value, zonaId: '', elementoId: '', tareaId: '' })}
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
                onChange={(e) => cambiar({ zonaId: e.target.value, elementoId: '', tareaId: '' })}
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

            <Campo etiqueta="Elemento constructivo" error={errores.elementoId} requerido>
              <Seleccion
                value={form.elementoId}
                onChange={(e) => cambiar({ elementoId: e.target.value, ...soltarTarea('elementoId', e.target.value) })}
                disabled={!form.zonaId}
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

            {/* La actividad define la unidad del paso 2 */}
            <Campo etiqueta="Actividad" error={errores.actividadId} requerido>
              <Seleccion
                value={form.actividadId}
                onChange={(e) => cambiar({ actividadId: e.target.value, ...soltarTarea('actividadId', e.target.value) })}
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
        </>
        )}

        {/* --- Paso 2: quien, cuanto y en cuanto tiempo --- */}
        {paso === 2 && (
        <>
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
            Personal
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {trabajadorElegido?.trabajador?.nombre ?? 'Este trabajador'} no tiene precio
              acordado para esta actividad: no se puede asignar. Acuerdalo primero en su
              ficha, en la seccion Trabajadores.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-obra-500">
            Medidas del elemento y trabajo del dia
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Medidas del elemento (no se escriben aqui) */}
            <div className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2 sm:col-span-2">
              <p className="text-xs text-obra-500">Medidas del elemento</p>
              {medidasElemento.largo > 0 ? (
                <>
                  <p className="text-base font-semibold tabular-nums text-obra-900">
                    {formatoNumero(medidasElemento.largo)} x {formatoNumero(medidasElemento.alto)} m
                    {modo === 'area' && medidasElemento.areaVanos > 0 && (
                      <span className="text-sm font-normal text-obra-500">
                        {' '}
                        − {formatoNumero(medidasElemento.areaVanos)} m2 de vanos
                      </span>
                    )}
                    {modo !== 'captura' && (
                      <span className="text-sm font-normal text-obra-500">
                        {' '}
                        → {formatoNumero(cantidadObra)} {unidad}
                        {modo === 'largo' ? ' (el largo)' : ''}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-obra-400">
                    {modo === 'captura'
                      ? `En ${unidad} la cantidad no sale de las medidas: escribela al lado.`
                      : 'Se miden en la ficha del elemento constructivo.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-obra-400">Elige el elemento constructivo</p>
              )}
            </div>
            {modo === 'captura' && (
              <Campo
                etiqueta={`${unidad} totales de la obra`}
                error={errores.cantidadTotal}
                requerido
              >
                <Entrada
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.cantidadTotal}
                  onChange={(e) => cambiar({ cantidadTotal: e.target.value })}
                  required
                />
              </Campo>
            )}
            <Campo etiqueta={`${unidad} ejecutados hoy`} error={errores.m2Ejecutados} requerido>
              <Entrada
                type="number"
                step="0.01"
                min="0.01"
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
              Lo ejecutado no puede superar los {formatoNumero(vista.area)} {unidad} de
              la obra.
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
                [`${unidad} de la obra`, formatoNumero(vista.area)],
                [`${unidad} pendientes`, formatoNumero(vista.pendiente)],
                ['Tiempo efectivo', formatoDuracion(vista.jornada.minutosEfectivos)],
                [
                  'Rendimiento',
                  vista.jornada.rendimiento === null
                    ? '-'
                    : `${formatoNumero(vista.jornada.rendimiento)} ${unidad}/h`,
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
                        ? 'h-full rounded-full bg-menta-400'
                        : 'h-full rounded-full bg-acento-500'
                    }
                    style={{ width: `${Math.min(100, vista.avance * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-acento-800">
                  {vista.completa
                    ? 'La obra queda terminada con este solo registro.'
                    : `Quedarian ${formatoNumero(vista.pendiente)} ${unidad}, que se cargan despues como registros de avance.`}
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
          error={errorGeneral}
        />
      </form>
      <VentanaError mensaje={ventanaError} onCerrar={cerrarVentanaError} />
    </Modal>
  )
}
