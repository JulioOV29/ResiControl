'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { useRecurso } from '@/lib/cliente'
import { formatoMoneda } from '@/lib/utils'
import type { Actividad, Cargo, Trabajador } from '@/types/dominio'

/** Una fila de la seccion de precios, todavia como texto del formulario. */
type FilaTarifa = { actividadId: string; valorM2: string }

export function FormTrabajador({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Trabajador | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const { datos: cargos } = useRecurso<Cargo>(abierto ? '/api/cargos' : null)
  const { datos: actividades } = useRecurso<Actividad>(abierto ? '/api/actividades' : null)
  const [form, setForm] = useState({
    documento: '',
    nombre: '',
    apellido: '',
    cargoId: '',
    activo: true,
  })

  /**
   * Los precios por metro de este trabajador, una fila por actividad. Van en su
   * propio estado y no dentro de `form` porque son una lista que crece y se
   * recorta con los botones de la seccion.
   */
  const [tarifas, setTarifas] = useState<FilaTarifa[]>([])

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            documento: registro.documento || '',
            nombre: registro.nombre,
            apellido: registro.apellido,
            cargoId: String(registro.cargoId),
            activo: registro.activo,
          }
        : { documento: '', nombre: '', apellido: '', cargoId: '', activo: true },
    )
    setTarifas(
      (registro?.tarifas ?? []).map((t) => ({
        actividadId: String(t.actividadId),
        valorM2: String(t.valorM2),
      })),
    )
  }, [abierto, registro])

  // Mas filas que actividades registradas no tiene sentido: cada actividad
  // lleva un solo precio, asi que el boton se agota cuando ya estan todas.
  const puedeAgregar = actividades.length > 0 && tarifas.length < actividades.length

  const agregarTarifa = () =>
    setTarifas((lista) => (puedeAgregar ? [...lista, { actividadId: '', valorM2: '' }] : lista))

  const quitarTarifa = (indice: number) =>
    setTarifas((lista) => lista.filter((_, i) => i !== indice))

  const cambiarTarifa = (indice: number, campos: Partial<FilaTarifa>) =>
    setTarifas((lista) => lista.map((f, i) => (i === indice ? { ...f, ...campos } : f)))

  /**
   * Las actividades que puede ofrecer una fila: las que no estan ya elegidas en
   * otra, mas la suya propia. Asi no se puede acordar dos precios distintos
   * para el mismo trabajo.
   */
  const actividadesPara = (indice: number) => {
    const tomadas = new Set(
      tarifas.filter((_, i) => i !== indice).map((t) => Number(t.actividadId)),
    )
    return actividades.filter((a) => !tomadas.has(a.id))
  }

  const unidadDe = (actividadId: string) =>
    actividades.find((a) => a.id === Number(actividadId))?.unidadMedida || 'm2'

  // Los errores de la lista llegan como 'tarifas.0.valorM2': se muestran juntos
  // encima de la seccion en vez de intentar colgarlos de cada input.
  const errorTarifas = Object.entries(errores).find(([campo]) =>
    campo.startsWith('tarifas'),
  )?.[1]

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/trabajadores/${registro.id}` : '/api/trabajadores',
      registro ? 'PUT' : 'POST',
      // Las filas a medio llenar no se mandan: una fila sin actividad no es un
      // precio, es un descuido.
      { ...form, tarifas: tarifas.filter((t) => t.actividadId && t.valorM2 !== '') },
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar trabajador' : 'Nuevo trabajador'}
      descripcion="Quien ejecuta la actividad en obra. No necesita cuenta en el sistema."
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" error={errores.nombre} requerido>
            <Entrada
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </Campo>
          <Campo etiqueta="Apellido" error={errores.apellido} requerido>
            <Entrada
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              required
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Documento" error={errores.documento}>
            <Entrada
              value={form.documento}
              onChange={(e) => setForm({ ...form, documento: e.target.value })}
              placeholder="1004567890"
            />
          </Campo>
          <Campo etiqueta="Cargo" error={errores.cargoId} requerido>
            <Seleccion
              value={form.cargoId}
              onChange={(e) => setForm({ ...form, cargoId: e.target.value })}
              required
            >
              <option value="">Selecciona...</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Seleccion>
          </Campo>
        </div>

        {/* --- Precios por actividad ------------------------------------- */}
        <div className="rounded-lg border border-obra-200 p-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-obra-900">Precios por actividad</p>
              <p className="text-xs text-obra-500">
                Lo que se le paga por metro en cada actividad que ejecuta.
              </p>
            </div>
            <button
              type="button"
              onClick={agregarTarifa}
              disabled={!puedeAgregar}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-obra-200 px-2.5 py-1.5 text-xs font-medium text-obra-700 hover:bg-obra-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                puedeAgregar
                  ? 'Agregar una actividad con su precio'
                  : 'Ya estan todas las actividades registradas'
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar actividad
            </button>
          </div>

          {errorTarifas && <p className="mt-2 text-xs text-red-600">{errorTarifas}</p>}

          {tarifas.length === 0 ? (
            <p className="mt-2 text-xs text-obra-400">
              Sin precios acordados. Las jornadas de este trabajador se guardaran sin importe
              hasta que se agregue al menos uno.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {tarifas.map((fila, indice) => (
                <li key={indice} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Seleccion
                      value={fila.actividadId}
                      onChange={(e) => cambiarTarifa(indice, { actividadId: e.target.value })}
                      required
                    >
                      <option value="">Selecciona la actividad...</option>
                      {actividadesPara(indice).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                          {a.activo ? '' : ' (inactiva)'}
                        </option>
                      ))}
                    </Seleccion>
                  </div>

                  <div className="relative w-36 shrink-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-obra-400">
                      $
                    </span>
                    <Entrada
                      type="number"
                      step="1"
                      min="0"
                      className="pl-7"
                      value={fila.valorM2}
                      onChange={(e) => cambiarTarifa(indice, { valorM2: e.target.value })}
                      placeholder="0"
                      title={`Precio por ${unidadDe(fila.actividadId)}`}
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => quitarTarifa(indice)}
                    className="shrink-0 rounded-lg border border-obra-200 p-2 text-obra-400 hover:bg-obra-50 hover:text-obra-700"
                    title="Quitar este precio"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tarifas.length > 0 && (
            <p className="mt-2 text-xs text-obra-500">
              {tarifas.length} de {actividades.length} actividades
              {tarifas.some((t) => t.valorM2 !== '') &&
                ` · la mas alta, ${formatoMoneda(
                  Math.max(...tarifas.map((t) => Number(t.valorM2) || 0)),
                )} por unidad`}
            </p>
          )}

          {actividades.length === 0 && (
            <p className="mt-2 text-xs text-acento-700">
              No hay actividades creadas todavia. Crea al menos una en la seccion Actividades.
            </p>
          )}

          {registro && (
            <p className="mt-2 text-xs text-obra-500">
              Cambiar un precio afecta a lo que se registre de aqui en adelante. Las jornadas ya
              guardadas conservan el precio que tenian, para que no se reliquide lo ya pagado.
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-obra-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            className="h-4 w-4 rounded border-obra-300 text-obra-900 focus:ring-acento-500"
          />
          Activo en obra
        </label>

        {cargos.length === 0 && (
          <p className="text-xs text-acento-700">
            No hay cargos creados todavia. Crea al menos uno en la seccion Cargos.
          </p>
        )}

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
