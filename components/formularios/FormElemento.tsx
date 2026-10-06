'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import { formatoNumero } from '@/lib/utils'
import { areaDeVanos, opcionesEstadoEjecucion as ESTADOS } from '@/lib/dominio'
import type { Elemento } from '@/types/dominio'

/** Vano en el formulario (como texto). */
type FilaVano = { descripcion: string; largo: string; ancho: string }

const vacio = {
  codigoDwg: '',
  descripcion: '',
  unidad: 'm2',
  largo: '',
  alto: '',
  estado: 'PENDIENTE',
}

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
  const { enviando, errorGeneral, errores, guardar } = useEnvio(abierto)
  const [form, setForm] = useState(vacio)
  /** Huecos del elemento (ventanas, puertas...). Su area se resta. */
  const [vanos, setVanos] = useState<FilaVano[]>([])

  useEffect(() => {
    if (!abierto) return
    if (!registro) {
      setForm(vacio)
      setVanos([])
      return
    }
    setForm({
      codigoDwg: registro.codigoDwg,
      descripcion: registro.descripcion,
      unidad: registro.unidad || 'm2',
      largo: String(registro.largo),
      alto: String(registro.alto),
      estado: registro.estado,
    })
    setVanos(
      (registro.vanos ?? []).map((v) => ({
        descripcion: v.descripcion ?? '',
        largo: String(v.largo),
        ancho: String(v.ancho),
      })),
    )
  }, [abierto, registro])

  const agregarVano = () => setVanos((lista) => [...lista, { descripcion: '', largo: '', ancho: '' }])
  const quitarVano = (indice: number) => setVanos((lista) => lista.filter((_, i) => i !== indice))
  const cambiarVano = (indice: number, campos: Partial<FilaVano>) =>
    setVanos((lista) => lista.map((v, i) => (i === indice ? { ...v, ...campos } : v)))

  // Area bruta, area de vanos y area neta, en vivo.
  const areaBruta = (Number(form.largo) || 0) * (Number(form.alto) || 0)
  const areaHuecos = areaDeVanos(vanos.map((v) => ({ largo: v.largo || 0, ancho: v.ancho || 0 })))
  const areaNeta = areaBruta - areaHuecos
  const vanosExcedidos = areaBruta > 0 && areaHuecos >= areaBruta

  // Los errores de la lista (vanos, vanos.0.largo...) se muestran juntos.
  const errorVanos = Object.entries(errores).find(([campo]) => campo.startsWith('vanos'))?.[1]

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/elementos/${registro.id}` : '/api/elementos',
      registro ? 'PUT' : 'POST',
      { ...form, zonaId, vanos },
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar elemento constructivo' : 'Nuevo elemento constructivo'}
      descripcion="El elemento fisico concreto sobre el que se ejecuta la actividad."
      abierto={abierto}
      onCerrar={onCerrar}
      ancho="lg"
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

        {/* Medidas del elemento: la tarea y el registro de obra las toman de aqui */}
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        {/* Vanos: huecos que no se ejecutan (ventanas, puertas...) */}
        <div className="rounded-lg border border-obra-200 p-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-obra-900">Vanos</p>
              <p className="text-xs text-obra-500">
                Ventanas, puertas u otros huecos. Su area se resta de la del elemento.
              </p>
            </div>
            <button
              type="button"
              onClick={agregarVano}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-obra-200 px-2.5 py-1.5 text-xs font-medium text-obra-700 hover:bg-obra-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar vano
            </button>
          </div>

          {errorVanos && <p className="mt-2 text-xs text-red-600">{errorVanos}</p>}

          {vanos.length === 0 ? (
            <p className="mt-2 text-xs text-obra-400">Sin vanos: se usa el area completa.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {vanos.map((vano, indice) => (
                <li key={indice} className="flex flex-wrap items-end gap-2 border-b border-obra-100 pb-2 last:border-0 last:pb-0 sm:flex-nowrap sm:border-0 sm:pb-0">
                  <Campo etiqueta={indice === 0 ? 'Descripcion' : ''} className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                    <Entrada
                      value={vano.descripcion}
                      onChange={(e) => cambiarVano(indice, { descripcion: e.target.value })}
                      placeholder="Ventana"
                    />
                  </Campo>
                  <Campo etiqueta={indice === 0 ? 'Largo (m)' : ''} className="min-w-0 flex-1 sm:w-24 sm:flex-none">
                    <Entrada
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={vano.largo}
                      onChange={(e) => cambiarVano(indice, { largo: e.target.value })}
                      placeholder="1.20"
                      required
                    />
                  </Campo>
                  <Campo etiqueta={indice === 0 ? 'Ancho (m)' : ''} className="min-w-0 flex-1 sm:w-24 sm:flex-none">
                    <Entrada
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={vano.ancho}
                      onChange={(e) => cambiarVano(indice, { ancho: e.target.value })}
                      placeholder="1.00"
                      required
                    />
                  </Campo>
                  <p className="hidden w-20 shrink-0 pb-2.5 text-right text-xs tabular-nums text-obra-500 sm:block">
                    {formatoNumero((Number(vano.largo) || 0) * (Number(vano.ancho) || 0))} m2
                  </p>
                  <button
                    type="button"
                    onClick={() => quitarVano(indice)}
                    className="shrink-0 rounded-lg border border-obra-200 p-2 text-obra-400 hover:bg-obra-50 hover:text-obra-700"
                    title="Quitar este vano"
                    aria-label="Quitar este vano"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Area bruta - vanos = area neta */}
        <dl className="grid grid-cols-3 gap-2 rounded-lg border border-obra-200 bg-obra-50 px-3 py-2 text-center">
          <div>
            <dt className="text-xs text-obra-500">Area del elemento</dt>
            <dd className="text-sm font-medium tabular-nums text-obra-900">
              {formatoNumero(areaBruta)} m2
            </dd>
          </div>
          <div>
            <dt className="text-xs text-obra-500">Vanos</dt>
            <dd className="text-sm font-medium tabular-nums text-obra-900">
              − {formatoNumero(areaHuecos)} m2
            </dd>
          </div>
          <div>
            <dt className="text-xs text-obra-500">Area neta</dt>
            <dd
              className={`text-base font-semibold tabular-nums ${vanosExcedidos ? 'text-red-600' : 'text-obra-900'}`}
            >
              {formatoNumero(areaNeta)} m2
            </dd>
          </div>
        </dl>
        {vanosExcedidos && (
          <p className="text-xs text-red-600">Los vanos no pueden ocupar toda el area del elemento.</p>
        )}

        {registro && (
          <p className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2 text-xs text-obra-500">
            Cambiar medidas o vanos afecta las obras que se abran desde ahora. Las obras ya
            abiertas conservan la cantidad que tenian.
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
          El mismo codigo DWG puede repetirse en otras zonas; aqui solo debe ser unico junto con
          la descripcion.
        </p>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
