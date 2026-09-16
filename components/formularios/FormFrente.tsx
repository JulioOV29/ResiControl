'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import type { Frente } from '@/types/dominio'
import { opcionesEstadoEjecucion as ESTADOS } from '@/lib/dominio'

export function FormFrente({
  abierto,
  registro,
  zonaId,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Frente | null
  zonaId: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState({
    codigoDwg: '',
    descripcion: '',
    unidad: 'm2',
    estado: 'PENDIENTE',
  })

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            codigoDwg: registro.codigoDwg,
            descripcion: registro.descripcion,
            unidad: registro.unidad || 'm2',
            estado: registro.estado,
          }
        : { codigoDwg: '', descripcion: '', unidad: 'm2', estado: 'PENDIENTE' },
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/frentes/${registro.id}` : '/api/frentes',
      registro ? 'PUT' : 'POST',
      { ...form, zonaId },
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar frente de trabajo' : 'Nuevo frente de trabajo'}
      descripcion="El elemento fisico concreto sobre el que se ejecuta la actividad."
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Codigo DWG" error={errores.codigoDwg} requerido>
            <Entrada
              value={form.codigoDwg}
              onChange={(e) => setForm({ ...form, codigoDwg: e.target.value })}
              placeholder="TC-P04"
              required
            />
          </Campo>
          <Campo etiqueta="Unidad" error={errores.unidad}>
            <Entrada
              value={form.unidad}
              onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              placeholder="m2"
            />
          </Campo>
        </div>

        <Campo etiqueta="Descripcion" error={errores.descripcion} requerido>
          <Entrada
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="MURO 016"
            required
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
          El mismo codigo DWG puede repetirse en otras zonas; aqui solo debe ser unico
          junto con la descripcion. Las medidas del elemento se capturan al abrir la obra
          con su primer registro.
        </p>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
