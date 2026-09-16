'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import type { Cargo } from '@/types/dominio'

export function FormCargo({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Cargo | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState({ nombre: '', descripcion: '' })

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? { nombre: registro.nombre, descripcion: registro.descripcion || '' }
        : { nombre: '', descripcion: '' },
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/cargos/${registro.id}` : '/api/cargos',
      registro ? 'PUT' : 'POST',
      form,
      onGuardado,
    )
  }

  return (
    <Modal titulo={registro ? 'Editar cargo' : 'Nuevo cargo'} abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <Campo etiqueta="Nombre" error={errores.nombre} requerido>
          <Entrada
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Oficial"
            required
          />
        </Campo>

        <Campo etiqueta="Descripcion" error={errores.descripcion}>
          <Entrada
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </Campo>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
