'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import type { Piso } from '@/types/dominio'

export function FormPiso({
  abierto,
  registro,
  torreId,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Piso | null
  torreId: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState({ numero: '', nombre: '', descripcion: '' })

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            numero: String(registro.numero),
            nombre: registro.nombre || '',
            descripcion: registro.descripcion || '',
          }
        : { numero: '', nombre: '', descripcion: '' },
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/pisos/${registro.id}` : '/api/pisos',
      registro ? 'PUT' : 'POST',
      { ...form, torreId },
      onGuardado,
    )
  }

  return (
    <Modal titulo={registro ? 'Editar piso' : 'Nuevo piso'} abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Numero" error={errores.numero} requerido>
            <Entrada
              type="number"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              placeholder="4"
              required
            />
          </Campo>
          <Campo etiqueta="Nombre" error={errores.nombre}>
            <Entrada
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Piso 4"
            />
          </Campo>
        </div>

        <Campo etiqueta="Descripcion" error={errores.descripcion}>
          <Entrada
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </Campo>

        <p className="text-xs text-obra-500">
          Usa numeros negativos para sotanos. El numero debe ser unico en la torre.
        </p>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
