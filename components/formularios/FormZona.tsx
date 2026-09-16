'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import type { Zona } from '@/types/dominio'

export function FormZona({
  abierto,
  registro,
  pisoId,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Zona | null
  pisoId: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState({ codigo: '', nombre: '', tipo: '', descripcion: '' })

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            codigo: registro.codigo,
            nombre: registro.nombre,
            tipo: registro.tipo || '',
            descripcion: registro.descripcion || '',
          }
        : { codigo: '', nombre: '', tipo: '', descripcion: '' },
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/zonas/${registro.id}` : '/api/zonas',
      registro ? 'PUT' : 'POST',
      { ...form, pisoId },
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar zona' : 'Nueva zona'}
      descripcion="Apartamento, area comun o cualquier subdivision del piso."
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Codigo" error={errores.codigo} requerido>
            <Entrada
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="405"
              required
            />
          </Campo>
          <Campo etiqueta="Nombre" error={errores.nombre} requerido>
            <Entrada
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Apto 405"
              required
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tipo" error={errores.tipo}>
            <Entrada
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              placeholder="Apartamento"
            />
          </Campo>
          <Campo etiqueta="Descripcion" error={errores.descripcion}>
            <Entrada
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </Campo>
        </div>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
