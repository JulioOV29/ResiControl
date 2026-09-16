'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion, AreaTexto } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { fechaParaInput } from '@/lib/utils'
import type { Proyecto } from '@/types/dominio'
import { opcionesEstadoProyecto as ESTADOS } from '@/lib/dominio'

const vacio = {
  codigo: '',
  nombre: '',
  descripcion: '',
  fechaInicio: '',
  fechaFin: '',
  estado: 'PLANEACION',
}

export function FormProyecto({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Proyecto | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState(vacio)

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            codigo: registro.codigo,
            nombre: registro.nombre,
            descripcion: registro.descripcion || '',
            fechaInicio: fechaParaInput(registro.fechaInicio),
            fechaFin: fechaParaInput(registro.fechaFin),
            estado: registro.estado,
          }
        : vacio,
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/proyectos/${registro.id}` : '/api/proyectos',
      registro ? 'PUT' : 'POST',
      form,
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar proyecto' : 'Nuevo proyecto'}
      descripcion="La obra sobre la que se cuelgan torres, cuadrillas y metas."
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Codigo" error={errores.codigo} requerido>
            <Entrada
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="PRY-085"
              required
            />
          </Campo>
          <Campo etiqueta="Nombre" error={errores.nombre} requerido className="sm:col-span-2">
            <Entrada
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Proyecto 85"
              required
            />
          </Campo>
        </div>

        <Campo etiqueta="Descripcion" error={errores.descripcion}>
          <AreaTexto
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Ubicacion, alcance, cliente..."
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Fecha de inicio" error={errores.fechaInicio}>
            <Entrada
              type="date"
              value={form.fechaInicio}
              onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Fecha de fin" error={errores.fechaFin}>
            <Entrada
              type="date"
              value={form.fechaFin}
              onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
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
        </div>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
