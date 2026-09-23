'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Seleccion, Entrada } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { useRecurso } from '@/lib/cliente'
import type { Trabajador } from '@/types/dominio'
import { hoyTexto } from '@/lib/utils'

export function FormAsignacion({
  abierto,
  cuadrillaId,
  yaAsignados,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  cuadrillaId: number
  yaAsignados: number[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const { datos: trabajadores } = useRecurso<Trabajador>(
    abierto ? '/api/trabajadores?activos=1' : null,
  )
  const [form, setForm] = useState({
    trabajadorId: '',
    fechaInicio: hoyTexto(),
  })

  useEffect(() => {
    if (!abierto) return
    setForm({ trabajadorId: '', fechaInicio: hoyTexto() })
  }, [abierto])

  const disponibles = trabajadores.filter((t) => !yaAsignados.includes(t.id))

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(`/api/cuadrillas/${cuadrillaId}/integrantes`, 'POST', form, onGuardado)
  }

  return (
    <Modal
      titulo="Asignar trabajador"
      descripcion="Si el trabajador venia de otra cuadrilla, esa asignacion se cierra y queda en el historial."
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <Campo etiqueta="Trabajador" error={errores.trabajadorId} requerido>
          <Seleccion
            value={form.trabajadorId}
            onChange={(e) => setForm({ ...form, trabajadorId: e.target.value })}
            required
          >
            <option value="">Selecciona...</option>
            {disponibles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.apellido} {t.nombre}
                {t.cargo ? ` - ${t.cargo.nombre}` : ''}
                {t.asignaciones?.[0] ? ` (hoy en ${t.asignaciones[0].cuadrilla.nombre})` : ''}
              </option>
            ))}
          </Seleccion>
        </Campo>

        <Campo etiqueta="Fecha de inicio" error={errores.fechaInicio} requerido>
          <Entrada
            type="date"
            value={form.fechaInicio}
            onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
            required
          />
        </Campo>

        {disponibles.length === 0 && (
          <p className="text-xs text-acento-700">
            No hay trabajadores activos disponibles para asignar.
          </p>
        )}

        <PieFormulario enviando={enviando} onCancelar={onCerrar} textoGuardar="Asignar" />
      </form>
    </Modal>
  )
}
