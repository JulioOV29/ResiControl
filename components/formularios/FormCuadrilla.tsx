'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { useRecurso } from '@/lib/cliente'
import type { Cuadrilla, Proyecto } from '@/types/dominio'

export function FormCuadrilla({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Cuadrilla | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const { datos: proyectos } = useRecurso<Proyecto>(abierto ? '/api/proyectos' : null)
  const [form, setForm] = useState({
    proyectoId: '',
    nombre: '',
    descripcion: '',
    activo: true,
  })

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            proyectoId: String(registro.proyectoId),
            nombre: registro.nombre,
            descripcion: registro.descripcion || '',
            activo: registro.activo,
          }
        : { proyectoId: '', nombre: '', descripcion: '', activo: true },
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/cuadrillas/${registro.id}` : '/api/cuadrillas',
      registro ? 'PUT' : 'POST',
      form,
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar cuadrilla' : 'Nueva cuadrilla'}
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <Campo etiqueta="Proyecto" error={errores.proyectoId} requerido>
          <Seleccion
            value={form.proyectoId}
            onChange={(e) => setForm({ ...form, proyectoId: e.target.value })}
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

        <Campo etiqueta="Nombre" error={errores.nombre} requerido>
          <Entrada
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Cuadrilla 1"
            required
          />
        </Campo>

        <Campo etiqueta="Descripcion" error={errores.descripcion}>
          <Entrada
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </Campo>

        <label className="flex items-center gap-2 text-sm text-obra-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            className="h-4 w-4 rounded border-obra-300 text-obra-900 focus:ring-acento-500"
          />
          Activa
        </label>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
