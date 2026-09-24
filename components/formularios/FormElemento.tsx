'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { formatoNumero } from '@/lib/utils'
import type { Elemento } from '@/types/dominio'
import { opcionesEstadoEjecucion as ESTADOS } from '@/lib/dominio'

export function FormElemento({
  abierto,
  registro,
  zonaId,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Elemento | null
  zonaId: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState({
    codigoDwg: '',
    descripcion: '',
    unidad: 'm2',
    largo: '',
    alto: '',
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
            largo: String(registro.largo),
            alto: String(registro.alto),
            estado: registro.estado,
          }
        : { codigoDwg: '', descripcion: '', unidad: 'm2', largo: '', alto: '', estado: 'PENDIENTE' },
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/elementos/${registro.id}` : '/api/elementos',
      registro ? 'PUT' : 'POST',
      { ...form, zonaId },
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar elemento constructivo' : 'Nuevo elemento constructivo'}
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

        {/*
          Las medidas se miden aqui una sola vez. La tarea que se asigne sobre
          este elemento y el registro que abra la obra las heredan, asi que no
          se vuelven a teclear: es la cantidad que hay que ejecutar.
        */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Largo (m)" error={errores.largo} requerido>
            <Entrada
              type="number"
              step="0.01"
              min="0.01"
              value={form.largo}
              onChange={(e) => setForm({ ...form, largo: e.target.value })}
              placeholder="12.00"
              required
            />
          </Campo>
          <Campo etiqueta="Alto (m)" error={errores.alto} requerido>
            <Entrada
              type="number"
              step="0.01"
              min="0.01"
              value={form.alto}
              onChange={(e) => setForm({ ...form, alto: e.target.value })}
              placeholder="2.70"
              required
            />
          </Campo>
          <div className="flex flex-col justify-end pb-1">
            <p className="text-xs text-obra-500">Cantidad por ejecutar</p>
            <p className="text-lg font-semibold tabular-nums text-obra-900">
              {formatoNumero((Number(form.largo) || 0) * (Number(form.alto) || 0))}{' '}
              <span className="text-sm font-normal text-obra-500">{form.unidad || 'm2'}</span>
            </p>
          </div>
        </div>

        {registro && (
          <p className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2 text-xs text-obra-500">
            Corregir las medidas cambia lo que falta por ejecutar de aqui en adelante. Las
            jornadas ya registradas conservan las que tenian, para que los indicadores de lo ya
            medido no se muevan.
          </p>
        )}

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
