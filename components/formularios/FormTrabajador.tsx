'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { useRecurso } from '@/lib/cliente'
import type { Cargo, Trabajador } from '@/types/dominio'

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
  const [form, setForm] = useState({
    documento: '',
    nombre: '',
    apellido: '',
    cargoId: '',
    activo: true,
  })

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
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/trabajadores/${registro.id}` : '/api/trabajadores',
      registro ? 'PUT' : 'POST',
      form,
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
