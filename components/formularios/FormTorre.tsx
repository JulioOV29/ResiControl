'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import type { Torre } from '@/types/dominio'
import { opcionesEstadoEjecucion as ESTADOS } from '@/lib/dominio'

export function FormTorre({
  abierto,
  registro,
  proyectoId,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Torre | null
  proyectoId: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    estado: 'PENDIENTE',
  })

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            codigo: registro.codigo,
            nombre: registro.nombre,
            descripcion: registro.descripcion || '',
            estado: registro.estado,
          }
        : { codigo: '', nombre: '', descripcion: '', estado: 'PENDIENTE' },
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/torres/${registro.id}` : '/api/torres',
      registro ? 'PUT' : 'POST',
      { ...form, proyectoId },
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar torre' : 'Nueva torre'}
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
              placeholder="TA"
              required
            />
          </Campo>
          <Campo etiqueta="Nombre" error={errores.nombre} requerido>
            <Entrada
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Torre A"
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

        <Campo etiqueta="Estado" error={errores.estado} requerido>
          <Seleccion
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
          >
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.texto}
              </option>
            ))}
          </Seleccion>
        </Campo>

        <p className="text-xs text-obra-500">
          El codigo debe ser unico dentro del proyecto.
        </p>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
