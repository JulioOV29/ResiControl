'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRightLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { enviar, pedir, useRecursoUnico } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Boton } from '@/components/ui/button'
import { Insignia } from '@/components/ui/badge'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/card'
import { BotonIcono } from '@/components/ui/acciones'
import { FormAsignacion } from '@/components/formularios/FormAsignacion'
import { formatoFecha, hoyTexto } from '@/lib/utils'
import type { Cuadrilla } from '@/types/dominio'

export default function CuadrillaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    dato: cuadrilla,
    cargando,
    error,
    recargar,
  } = useRecursoUnico<Cuadrilla>(`/api/cuadrillas/${id}`)
  const puede = usePuede()
  const [asignando, setAsignando] = useState(false)
  const [procesando, setProcesando] = useState(0)

  const cerrarAsignacion = async (asignacionId: number) => {
    setProcesando(asignacionId)
    // La fecha de cierre sale del equipo del residente, no del reloj UTC del
    // servidor.
    await enviar(`/api/cuadrillas/${id}/integrantes/${asignacionId}`, 'PATCH', {
      fechaFin: hoyTexto(),
    })
    setProcesando(0)
    recargar()
  }

  const borrarAsignacion = async (asignacionId: number) => {
    setProcesando(asignacionId)
    await pedir(`/api/cuadrillas/${id}/integrantes/${asignacionId}`, { method: 'DELETE' })
    setProcesando(0)
    recargar()
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-obra-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    )
  }

  if (error || !cuadrilla) {
    return (
      <EstadoVacio
        titulo="No se encontro la cuadrilla"
        mensaje={error || 'Puede que haya sido eliminada.'}
        accion={
          <Link href="/cuadrillas">
            <Boton variante="contorno">Volver a cuadrillas</Boton>
          </Link>
        }
      />
    )
  }

  const integrantes = cuadrilla.integrantes ?? []
  const activos = integrantes.filter((i) => i.activo)
  const historicos = integrantes.filter((i) => !i.activo)
  const idsActivos = activos.map((i) => i.trabajadorId)

  return (
    <div>
      <Link
        href="/cuadrillas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-obra-500 hover:text-obra-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Cuadrillas
      </Link>

      <EncabezadoPagina
        titulo={cuadrilla.nombre}
        descripcion={`${cuadrilla.proyecto?.codigo} - ${cuadrilla.proyecto?.nombre}${
          cuadrilla.descripcion ? ` | ${cuadrilla.descripcion}` : ''
        }`}
        acciones={
          puede.gestionar && (
            <Boton onClick={() => setAsignando(true)}>
              <Plus className="h-4 w-4" />
              Asignar trabajador
            </Boton>
          )
        }
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-obra-500">
        Integrantes actuales ({activos.length})
      </h2>

      {activos.length === 0 ? (
        <EstadoVacio
          titulo="La cuadrilla esta vacia"
          mensaje="Asigna trabajadores para poder atribuirle produccion a esta cuadrilla."
          accion={
            puede.gestionar && <Boton onClick={() => setAsignando(true)}>Asignar el primero</Boton>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activos.map((a) => (
            <Tarjeta key={a.id}>
              <TarjetaCuerpo className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-obra-900">
                    {a.trabajador?.apellido} {a.trabajador?.nombre}
                  </p>
                  <p className="mt-0.5 text-sm text-obra-500">{a.trabajador?.cargo.nombre}</p>
                  <p className="mt-2 text-xs text-obra-400">Desde {formatoFecha(a.fechaInicio)}</p>
                </div>
                {puede.gestionar && (
                  <BotonIcono
                    icono={procesando === a.id ? Loader2 : ArrowRightLeft}
                    titulo="Retirar de la cuadrilla"
                    onClick={() => cerrarAsignacion(a.id)}
                  />
                )}
              </TarjetaCuerpo>
            </Tarjeta>
          ))}
        </div>
      )}

      {historicos.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-obra-500">
            Historial ({historicos.length})
          </h2>
          <Tarjeta>
            <ul className="divide-y divide-obra-100">
              {historicos.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-obra-700">
                      {a.trabajador?.apellido} {a.trabajador?.nombre}
                    </p>
                    <p className="text-xs text-obra-500">
                      {formatoFecha(a.fechaInicio)} a {formatoFecha(a.fechaFin)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Insignia>Cerrada</Insignia>
                    {puede.gestionar && (
                      <BotonIcono
                        icono={Trash2}
                        titulo="Borrar del historial"
                        tono="peligro"
                        onClick={() => borrarAsignacion(a.id)}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Tarjeta>
          <p className="mt-2 text-xs text-obra-500">
            El historial se conserva a proposito: permite analizar el desempeno de un trabajador
            en cada cuadrilla por la que paso.
          </p>
        </>
      )}

      <FormAsignacion
        abierto={asignando}
        cuadrillaId={Number(id)}
        yaAsignados={idsActivos}
        onCerrar={() => setAsignando(false)}
        onGuardado={() => {
          setAsignando(false)
          recargar()
        }}
      />
    </div>
  )
}
