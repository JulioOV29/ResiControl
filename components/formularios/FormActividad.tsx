'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { UNIDADES_MEDIDA } from '@/lib/dominio'
import type { Actividad } from '@/types/dominio'

export function FormActividad({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Actividad | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio(abierto)
  const [form, setForm] = useState({
    nombre: '',
    unidadMedida: 'm2',
    descripcion: '',
    activo: true,
  })

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            nombre: registro.nombre,
            unidadMedida: registro.unidadMedida,
            descripcion: registro.descripcion || '',
            activo: registro.activo,
          }
        : { nombre: '', unidadMedida: 'm2', descripcion: '', activo: true },
    )
  }, [abierto, registro])

  // Si la unidad guardada ya no esta en la lista, se sigue ofreciendo.
  const unidadFueraDeLista =
    Boolean(form.unidadMedida) && !UNIDADES_MEDIDA.some((u) => u.valor === form.unidadMedida)

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/actividades/${registro.id}` : '/api/actividades',
      registro ? 'PUT' : 'POST',
      form,
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar actividad' : 'Nueva actividad'}
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Nombre" error={errores.nombre} requerido className="sm:col-span-2">
            <Entrada
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Panete"
              required
            />
          </Campo>
          <Campo etiqueta="Unidad de medida" error={errores.unidadMedida} requerido>
            <Seleccion
              value={form.unidadMedida}
              onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}
              required
            >
              {UNIDADES_MEDIDA.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.texto}
                </option>
              ))}

              {/* Unidad antigua que ya no esta en la lista */}
              {unidadFueraDeLista && (
                <option value={form.unidadMedida}>{form.unidadMedida} (actual)</option>
              )}
            </Seleccion>
          </Campo>
        </div>

        <Campo etiqueta="Descripcion" error={errores.descripcion}>
          <Entrada
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </Campo>

        {/* El precio se define en la ficha de cada trabajador */}
        <p className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2 text-xs text-obra-500">
          El precio por {form.unidadMedida || 'unidad'} se acuerda con cada trabajador y se
          captura en su ficha, en la seccion Trabajadores.
        </p>

        <label className="flex items-center gap-2 text-sm text-obra-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            className="h-4 w-4 rounded border-obra-300 text-obra-900 focus:ring-acento-500"
          />
          Activa: aparece al registrar ejecucion
        </label>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
