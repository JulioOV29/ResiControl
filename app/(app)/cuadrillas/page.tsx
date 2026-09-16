'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useRecurso, useEliminacion } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Insignia } from '@/components/ui/badge'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { FormCuadrilla } from '@/components/formularios/FormCuadrilla'
import type { Cuadrilla } from '@/types/dominio'

export default function CuadrillasPage() {
  const router = useRouter()
  const { datos, cargando, recargar } = useRecurso<Cuadrilla>('/api/cuadrillas')
  const puede = usePuede()
  const eliminacion = useEliminacion('/api/cuadrillas', recargar)
  const [form, setForm] = useState<{ abierto: boolean; registro: Cuadrilla | null }>({
    abierto: false,
    registro: null,
  })

  const abrirNuevo = () => setForm({ abierto: true, registro: null })

  const columnas: Columna<Cuadrilla>[] = [
    { clave: 'nombre', titulo: 'Cuadrilla', render: (c) => c.nombre },
    { clave: 'proyecto', titulo: 'Proyecto', render: (c) => c.proyecto?.codigo ?? '-' },
    {
      clave: 'integrantes',
      titulo: 'Asignaciones',
      alineacion: 'derecha',
      render: (c) => c._count?.integrantes ?? 0,
    },
    {
      clave: 'registros',
      titulo: 'Registros',
      alineacion: 'derecha',
      soloEscritorio: true,
      render: (c) => c._count?.registros ?? 0,
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (c) => (
        <Insignia tono={c.activo ? 'exito' : 'neutro'}>{c.activo ? 'Activa' : 'Inactiva'}</Insignia>
      ),
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Cuadrillas"
        descripcion="Equipos de trabajo. Entra a una cuadrilla para gestionar sus integrantes."
        acciones={
          puede.gestionar && (
            <Boton onClick={abrirNuevo}>
              <Plus className="h-4 w-4" />
              Nueva cuadrilla
            </Boton>
          )
        }
      />

      <Tabla
        columnas={columnas}
        filas={datos}
        cargando={cargando}
        onFilaClick={(c) => router.push(`/cuadrillas/${c.id}`)}
        acciones={
          puede.gestionar
            ? (c) => (
                <AccionesEditarBorrar
                  onEditar={() => setForm({ abierto: true, registro: c })}
                  onEliminar={() => eliminacion.pedir(c.id, c.nombre)}
                />
              )
            : undefined
        }
        vacio={
          <EstadoVacio
            titulo="Sin cuadrillas"
            mensaje="Una cuadrilla agrupa trabajadores dentro de un proyecto y es a quien se le atribuye la produccion."
            accion={puede.gestionar && <Boton onClick={abrirNuevo}>Crear la primera</Boton>}
          />
        }
      />

      <FormCuadrilla
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
        titulo="Eliminar cuadrilla"
        mensaje={`Se eliminara "${eliminacion.objetivo?.etiqueta}" junto con su historial de integrantes. No se puede si ya tiene registros de ejecucion.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
