'use client'

import { CalendarDays } from 'lucide-react'
import { formatoNumero, formatoPorcentaje } from '@/lib/utils'
import { formatoDuracion } from '@/lib/calculos'

/**
 * El informe de un dia: lo que se produjo, en que actividades y a que ritmo.
 *
 * Vive al lado del calendario y se llena al pulsar un dia. No consulta nada:
 * son los mismos numeros que el panel ya calculo para ese dia, leidos de otra
 * manera. El calendario responde "cuando", este bloque responde "que paso ese
 * dia".
 */

type Dia = {
  fecha: string
  m2Ejecutados: number
  m2Meta: number
  registros: number
  horasEfectivas: number
  rendimiento: number | null
  /** m2 del dia repartidos por actividad, con el id de la actividad de clave. */
  porActividad: Record<string, number>
}

type Actividad = { clave: string; etiqueta: string }

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** "2026-09-01" -> "martes, 1 de septiembre". Se lee en UTC, como se guarda. */
function textoFecha(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`)
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

/** Un numero grande con su etiqueta encima. */
function Dato({
  etiqueta,
  valor,
  unidad,
  detalle,
}: {
  etiqueta: string
  valor: string
  unidad?: string
  detalle?: string
}) {
  return (
    <div className="rounded-lg border border-obra-100 bg-obra-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-obra-400">{etiqueta}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-obra-900">
        {valor}
        {unidad && <span className="ml-1 text-xs font-normal text-obra-500">{unidad}</span>}
      </p>
      {detalle && <p className="mt-1 text-[11px] text-obra-500">{detalle}</p>}
    </div>
  )
}

export function InformeDia({
  dia,
  actividades,
}: {
  dia: Dia | null
  /** Las actividades del periodo, para poner nombre a cada id. */
  actividades: Actividad[]
}) {
  if (!dia) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-obra-200 px-6 text-center">
        <CalendarDays className="mb-2 h-5 w-5 text-obra-300" />
        <p className="text-sm font-medium text-obra-600">Pulsa un dia marcado</p>
        <p className="mt-1 text-xs text-obra-400">
          Aqui aparece lo que se hizo ese dia: produccion, actividades y rendimiento.
        </p>
      </div>
    )
  }

  const cumplimiento = dia.m2Meta > 0 ? dia.m2Ejecutados / dia.m2Meta : null

  // Solo las actividades que tuvieron produccion ese dia, de mayor a menor.
  const reparto = actividades
    .map((a) => ({ etiqueta: a.etiqueta, m2: dia.porActividad[a.clave] ?? 0 }))
    .filter((a) => a.m2 > 0)
    .sort((a, b) => b.m2 - a.m2)

  return (
    <div className="flex h-full flex-col">
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-obra-400">
          Informe del dia
        </p>
        <h3 className="text-sm font-semibold capitalize text-obra-900">{textoFecha(dia.fecha)}</h3>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Dato
          etiqueta="Produccion"
          valor={formatoNumero(dia.m2Ejecutados)}
          unidad="m2"
          detalle={`${dia.registros} jornada${dia.registros === 1 ? '' : 's'}`}
        />
        <Dato
          etiqueta="Rendimiento"
          valor={dia.rendimiento === null ? '-' : formatoNumero(dia.rendimiento)}
          unidad="m2/h"
          detalle={formatoDuracion(Math.round(dia.horasEfectivas * 60))}
        />
        <Dato
          etiqueta="Cumplimiento"
          valor={cumplimiento === null ? '-' : formatoPorcentaje(cumplimiento)}
          detalle={dia.m2Meta > 0 ? `meta ${formatoNumero(dia.m2Meta)} m2` : 'sin meta ese dia'}
        />
        <Dato
          etiqueta="Actividades"
          valor={String(reparto.length)}
          detalle={reparto.length ? reparto[0].etiqueta : '-'}
        />
      </div>

      {/* Reparto por actividad: la barra es la parte del dia, el numero manda */}
      <div className="mt-4 min-h-0 flex-1">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-obra-400">
          Que se hizo ese dia
        </p>

        {reparto.length === 0 ? (
          <p className="text-xs text-obra-400">Sin produccion registrada.</p>
        ) : (
          <ul className="space-y-2">
            {reparto.map((a) => {
              const parte = dia.m2Ejecutados > 0 ? a.m2 / dia.m2Ejecutados : 0
              return (
                <li key={a.etiqueta}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-obra-800">{a.etiqueta}</span>
                    <span className="shrink-0 tabular-nums text-obra-900">
                      {formatoNumero(a.m2)} m2
                      <span className="ml-1.5 text-obra-400">{formatoPorcentaje(parte, 0)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-obra-100">
                    <div
                      className="h-full rounded-full bg-marca-600"
                      style={{ width: `${Math.max(2, parte * 100)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
