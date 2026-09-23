'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRecurso, useEliminacion } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Insignia } from '@/components/ui/badge'
import { Seleccion } from '@/components/ui/input'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { FormMeta } from '@/components/formularios/FormMeta'
import { formatoFecha, formatoNumero, hoyTexto } from '@/lib/utils'
import type { Meta, Proyecto } from '@/types/dominio'

export default function MetasPage() {
  const [proyectoId, setProyectoId] = useState('')
  const { datos: proyectos } = useRecurso<Proyecto>('/api/proyectos')
  const { datos, cargando, recargar } = useRecurso<Meta>(
    proyectoId ? `/api/metas?proyectoId=${proyectoId}` : '/api/metas',
  )
  const puede = usePuede()
  const eliminacion = useEliminacion('/api/metas', recargar)
  const [form, setForm] = useState<{ abierto: boolean; registro: Meta | null }>({
    abierto: false,
    registro: null,
  })

  const abrirNuevo = () => setForm({ abierto: true, registro: null })

  const vigente = (m: Meta) => {
    const hoy = hoyTexto()
    const desde = m.vigenciaDesde.slice(0, 10)
    const hasta = m.vigenciaHasta?.slice(0, 10)
    return desde <= hoy && (!hasta || hasta >= hoy)
  }

  const columnas: Columna<Meta>[] = [
    { clave: 'actividad', titulo: 'Actividad', render: (m) => m.actividad?.nombre ?? '-' },
    {
      clave: 'proyecto',
      titulo: 'Proyecto',
      soloEscritorio: true,
      render: (m) => m.proyecto?.codigo ?? '-',
    },
    {
      clave: 'cargo',
      titulo: 'Cargo',
      render: (m) => m.cargo?.nombre ?? <span className="text-obra-400">Todos</span>,
    },
    {
      clave: 'rendimiento',
      titulo: 'Rendimiento',
      alineacion: 'derecha',
      render: (m) =>
        m.rendimientoObjetivo === null ? '-' : `${formatoNumero(m.rendimientoObjetivo)} m2/h`,
    },
    {
      clave: 'm2',
      titulo: 'm2 objetivo',
      alineacion: 'derecha',
      render: (m) => (m.m2Objetivo === null ? '-' : formatoNumero(m.m2Objetivo)),
    },
    {
      clave: 'vigencia',
      titulo: 'Vigencia',
      render: (m) => (
        <div className="flex items-center gap-2">
          <span>
            {formatoFecha(m.vigenciaDesde)}
            {m.vigenciaHasta ? ` a ${formatoFecha(m.vigenciaHasta)}` : ' en adelante'}
          </span>
          {vigente(m) && <Insignia tono="exito">Vigente</Insignia>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Metas"
        descripcion="Objetivos contra los que se mide el cumplimiento de la ejecucion."
        acciones={
          puede.gestionar && (
            <Boton onClick={abrirNuevo}>
              <Plus className="h-4 w-4" />
              Nueva meta
            </Boton>
          )
        }
      />

      <div className="mb-4 max-w-xs">
        <Seleccion value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} - {p.nombre}
            </option>
          ))}
        </Seleccion>
      </div>

      <Tabla
        columnas={columnas}
        filas={datos}
        cargando={cargando}
        acciones={
          puede.gestionar
            ? (m) => (
                <AccionesEditarBorrar
                  onEditar={() => setForm({ abierto: true, registro: m })}
                  onEliminar={() =>
                    eliminacion.pedir(m.id, `${m.actividad?.nombre} en ${m.proyecto?.codigo}`)
                  }
                />
              )
            : undefined
        }
        vacio={
          <EstadoVacio
            titulo="Sin metas"
            mensaje="Sin meta no hay cumplimiento que calcular. Define al menos un rendimiento objetivo por actividad."
            accion={puede.gestionar && <Boton onClick={abrirNuevo}>Crear la primera</Boton>}
          />
        }
      />

      <FormMeta
        abierto={form.abierto}
        registro={form.registro}
        onCerrar={() => setForm({ abierto: false, registro: null })}
        onGuardado={() => {
          setForm({ abierto: false, registro: null })
          recargar()
        }}
      />

      <ConfirmarEliminacion
        abierto={Boolean(eliminacion.objetivo)}
        titulo="Eliminar meta"
        mensaje={`Se eliminara la meta de ${eliminacion.objetivo?.etiqueta}. Los registros ya guardados conservan la meta que tenian al momento de capturarlos.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
