'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRecurso, useRecursoUnico } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Seleccion } from '@/components/ui/input'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/card'
import { Insignia } from '@/components/ui/badge'
import { FormLiquidacion } from '@/components/formularios/FormLiquidacion'
import { DetalleLiquidacion, textoCuenta } from '@/components/DetalleLiquidacion'
import { ETIQUETA_PERIODO } from '@/lib/dominio'
import { formatoFecha, formatoMoneda, formatoMomento } from '@/lib/utils'
import type { Catalogos, Liquidacion } from '@/types/dominio'

/** Liquidaciones: pagos a los trabajadores por lo que ejecutaron en un lapso. */
export default function LiquidacionesPage() {
  const puede = usePuede()
  const [trabajadorId, setTrabajadorId] = useState('')
  const { datos, cargando, error, recargar } = useRecurso<Liquidacion>(
    trabajadorId ? `/api/liquidaciones?trabajadorId=${trabajadorId}` : '/api/liquidaciones',
  )
  const { dato: catalogos } = useRecursoUnico<Catalogos>('/api/catalogos')
  const [formAbierto, setFormAbierto] = useState(false)
  const [detalle, setDetalle] = useState<number | null>(null)

  const total = datos.reduce((suma, l) => suma + l.total, 0)

  const columnas: Columna<Liquidacion>[] = [
    {
      clave: 'codigo',
      titulo: 'Liquidacion',
      render: (l) => (
        <div>
          <div className="font-medium text-obra-900">{l.codigo}</div>
          <div className="text-xs text-obra-400">{formatoMomento(l.createdAt)}</div>
        </div>
      ),
    },
    {
      clave: 'trabajador',
      titulo: 'Trabajador',
      render: (l) => (
        <div>
          <div className="text-obra-900">
            {l.trabajador.apellido} {l.trabajador.nombre}
          </div>
          <div className="text-xs text-obra-400">{l.trabajador.cargo.nombre}</div>
        </div>
      ),
    },
    {
      clave: 'periodo',
      titulo: 'Periodo',
      render: (l) => (
        <div>
          <Insignia tono="info">{ETIQUETA_PERIODO[l.tipoPeriodo]}</Insignia>
          <div className="mt-0.5 text-xs text-obra-500">
            {formatoFecha(l.desde)} a {formatoFecha(l.hasta)}
          </div>
        </div>
      ),
    },
    {
      clave: 'cuenta',
      titulo: 'Cuenta',
      soloEscritorio: true,
      render: (l) => <span className="text-sm text-obra-600">{textoCuenta(l)}</span>,
    },
    {
      clave: 'responsable',
      titulo: 'Responsable',
      soloEscritorio: true,
      render: (l) => `${l.usuarioLiquida.nombre} ${l.usuarioLiquida.apellido}`,
    },
    {
      clave: 'total',
      titulo: 'Total',
      alineacion: 'derecha',
      render: (l) => (
        <div>
          <div className="font-semibold tabular-nums text-obra-900">{formatoMoneda(l.total)}</div>
          <div className="text-xs text-obra-400">{l._count?.registros ?? 0} jornadas</div>
        </div>
      ),
    },
  ]

  if (!puede.liquidar && puede.rol) {
    return (
      <div>
        <EncabezadoPagina titulo="Liquidaciones" descripcion="Pagos a los trabajadores." />
        <Tarjeta>
          <TarjetaCuerpo className="py-10 text-center text-sm text-obra-500">
            Tu rol no tiene acceso a las liquidaciones.
          </TarjetaCuerpo>
        </Tarjeta>
      </div>
    )
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Liquidaciones"
        descripcion="Pagos a los trabajadores por lo que ejecutaron, a los precios acordados con cada uno."
        acciones={
          <Boton onClick={() => setFormAbierto(true)}>
            <Plus className="h-4 w-4" />
            Nueva liquidacion
          </Boton>
        }
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-72">
          <Seleccion value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}>
            <option value="">Todos los trabajadores</option>
            {(catalogos?.trabajadores ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.apellido} {t.nombre}
              </option>
            ))}
          </Seleccion>
        </div>
        {datos.length > 0 && (
          <p className="text-sm text-obra-600">
            {datos.length} liquidacion{datos.length === 1 ? '' : 'es'} ·{' '}
            <span className="font-semibold tabular-nums text-obra-900">{formatoMoneda(total)}</span>
          </p>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Tabla
        columnas={columnas}
        filas={datos}
        cargando={cargando}
        onFilaClick={(l) => setDetalle(l.id)}
        vacio={
          <EstadoVacio
            titulo="Sin liquidaciones"
            mensaje="Una liquidacion paga lo que un trabajador ejecuto en un mes, una quincena o un rango de fechas, a los precios acordados en su ficha."
            accion={<Boton onClick={() => setFormAbierto(true)}>Crear la primera</Boton>}
          />
        }
      />

      <FormLiquidacion
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={(creada) => {
          setFormAbierto(false)
          recargar()
          // Al crearla se abre su comprobante.
          setDetalle(creada.id)
        }}
      />

      <DetalleLiquidacion
        liquidacionId={detalle}
        onCerrar={() => setDetalle(null)}
        onAnulada={() => {
          setDetalle(null)
          recargar()
        }}
      />
    </div>
  )
}
