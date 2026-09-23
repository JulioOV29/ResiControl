'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { useRecurso } from '@/lib/cliente'
import { fechaParaInput, hoyTexto } from '@/lib/utils'
import type { Actividad, Cargo, Meta, Proyecto } from '@/types/dominio'

export function FormMeta({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Meta | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const { datos: proyectos } = useRecurso<Proyecto>(abierto ? '/api/proyectos' : null)
  const { datos: actividades } = useRecurso<Actividad>(abierto ? '/api/actividades?activas=1' : null)
  const { datos: cargos } = useRecurso<Cargo>(abierto ? '/api/cargos' : null)

  const inicial = {
    proyectoId: '',
    actividadId: '',
    cargoId: '',
    rendimientoObjetivo: '',
    m2Objetivo: '',
    vigenciaDesde: hoyTexto(),
    vigenciaHasta: '',
  }
  const [form, setForm] = useState(inicial)

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            proyectoId: String(registro.proyectoId),
            actividadId: String(registro.actividadId),
            cargoId: registro.cargoId ? String(registro.cargoId) : '',
            rendimientoObjetivo:
              registro.rendimientoObjetivo === null ? '' : String(registro.rendimientoObjetivo),
            m2Objetivo: registro.m2Objetivo === null ? '' : String(registro.m2Objetivo),
            vigenciaDesde: fechaParaInput(registro.vigenciaDesde),
            vigenciaHasta: fechaParaInput(registro.vigenciaHasta),
          }
        : inicial,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/metas/${registro.id}` : '/api/metas',
      registro ? 'PUT' : 'POST',
      form,
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar meta' : 'Nueva meta'}
      descripcion="El objetivo contra el que se mide el cumplimiento de la ejecucion."
      abierto={abierto}
      onCerrar={onCerrar}
      ancho="lg"
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <div className="grid gap-4 sm:grid-cols-2">
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

          <Campo etiqueta="Actividad" error={errores.actividadId} requerido>
            <Seleccion
              value={form.actividadId}
              onChange={(e) => setForm({ ...form, actividadId: e.target.value })}
              required
            >
              <option value="">Selecciona...</option>
              {actividades.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </Seleccion>
          </Campo>
        </div>

        <Campo etiqueta="Cargo" error={errores.cargoId}>
          <Seleccion
            value={form.cargoId}
            onChange={(e) => setForm({ ...form, cargoId: e.target.value })}
          >
            <option value="">Aplica a todos los cargos</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Rendimiento objetivo (m2/h)"
            error={errores.rendimientoObjetivo}
          >
            <Entrada
              type="number"
              step="0.01"
              value={form.rendimientoObjetivo}
              onChange={(e) => setForm({ ...form, rendimientoObjetivo: e.target.value })}
              placeholder="2.20"
            />
          </Campo>
          <Campo etiqueta="m2 objetivo" error={errores.m2Objetivo}>
            <Entrada
              type="number"
              step="0.01"
              value={form.m2Objetivo}
              onChange={(e) => setForm({ ...form, m2Objetivo: e.target.value })}
              placeholder="22.00"
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Vigencia desde" error={errores.vigenciaDesde} requerido>
            <Entrada
              type="date"
              value={form.vigenciaDesde}
              onChange={(e) => setForm({ ...form, vigenciaDesde: e.target.value })}
              required
            />
          </Campo>
          <Campo etiqueta="Vigencia hasta" error={errores.vigenciaHasta}>
            <Entrada
              type="date"
              value={form.vigenciaHasta}
              onChange={(e) => setForm({ ...form, vigenciaHasta: e.target.value })}
            />
          </Campo>
        </div>

        <p className="text-xs text-obra-500">
          Deja la vigencia hasta en blanco si la meta sigue abierta. Una misma actividad
          puede tener metas distintas por proyecto, cargo o periodo.
        </p>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
