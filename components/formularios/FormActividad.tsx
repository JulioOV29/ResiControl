'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
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
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState({
    nombre: '',
    unidadMedida: 'm2',
    descripcion: '',
    valorM2: '',
    activo: true,
  })

  const tarifaOriginal = registro?.valorM2 == null ? '' : String(registro.valorM2)

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            nombre: registro.nombre,
            unidadMedida: registro.unidadMedida,
            descripcion: registro.descripcion || '',
            valorM2: registro.valorM2 == null ? '' : String(registro.valorM2),
            activo: registro.activo,
          }
        : { nombre: '', unidadMedida: 'm2', descripcion: '', valorM2: '', activo: true },
    )
  }, [abierto, registro])

  /** Cambiar la tarifa solo afecta lo que se registre de aqui en adelante. */
  const cambiaTarifa = Boolean(registro) && form.valorM2 !== tarifaOriginal

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
          <Campo etiqueta="Unidad" error={errores.unidadMedida} requerido>
            <Entrada
              value={form.unidadMedida}
              onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}
              placeholder="m2"
              required
            />
          </Campo>
        </div>

        <Campo etiqueta="Descripcion" error={errores.descripcion}>
          <Entrada
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </Campo>

        <Campo
          etiqueta={`Valor por ${form.unidadMedida || 'unidad'} ejecutado`}
          error={errores.valorM2}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-obra-400">
              $
            </span>
            <Entrada
              type="number"
              step="1"
              min="0"
              className="pl-7"
              value={form.valorM2}
              onChange={(e) => setForm({ ...form, valorM2: e.target.value })}
              placeholder="0"
            />
          </div>
          <p className="mt-1.5 text-xs text-obra-500">
            Lo que se paga por cada {form.unidadMedida || 'unidad'} ejecutado de esta actividad.
            Puede quedar vacio si todavia no se ha acordado.
          </p>
        </Campo>

        {cambiaTarifa && (
          <div className="rounded-lg border border-marca-200 bg-marca-50 px-3 py-2 text-xs text-marca-700">
            La tarifa nueva aplica a lo que se registre de aqui en adelante. Las jornadas ya
            guardadas conservan la tarifa que tenian, para que cambiar el precio hoy no
            reliquide lo que ya se pago.
          </div>
        )}

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
