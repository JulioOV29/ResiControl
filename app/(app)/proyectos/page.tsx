'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useRecurso, useEliminacion } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Insignia, tonoEstado, textoEstado } from '@/components/ui/badge'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { FormProyecto } from '@/components/formularios/FormProyecto'
import { formatoFecha } from '@/lib/utils'
import type { Proyecto } from '@/types/dominio'

export default function ProyectosPage() {
  const router = useRouter()
  const { datos, cargando, recargar } = useRecurso<Proyecto>('/api/proyectos')
  const puede = usePuede()
  const eliminacion = useEliminacion('/api/proyectos', recargar)
  const [form, setForm] = useState<{ abierto: boolean; registro: Proyecto | null }>({
    abierto: false,
    registro: null,
  })

  const abrirNuevo = () => setForm({ abierto: true, registro: null })

  const columnas: Columna<Proyecto>[] = [
    {
      clave: 'nombre',
      titulo: 'Proyecto',
      render: (p) => (
        <div>
          <span className="font-medium text-obra-900">{p.nombre}</span>
          <span className="ml-2 text-xs text-obra-400">{p.codigo}</span>
        </div>
      ),
    },
    {
      clave: 'torres',
      titulo: 'Torres',
      alineacion: 'derecha',
      render: (p) => p._count?.torres ?? 0,
    },
    {
      clave: 'cuadrillas',
      titulo: 'Cuadrillas',
      alineacion: 'derecha',
      soloEscritorio: true,
      render: (p) => p._count?.cuadrillas ?? 0,
    },
    {
      clave: 'inicio',
      titulo: 'Inicio',
      soloEscritorio: true,
      render: (p) => formatoFecha(p.fechaInicio),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (p) => <Insignia tono={tonoEstado(p.estado)}>{textoEstado(p.estado)}</Insignia>,
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Proyectos"
        descripcion="Entra a un proyecto para gestionar sus torres, pisos, zonas y frentes de trabajo."
        acciones={
          puede.gestionar && (
            <Boton onClick={abrirNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Boton>
          )
        }
      />

      <Tabla
        columnas={columnas}
        filas={datos}
        cargando={cargando}
        onFilaClick={(p) => router.push(`/proyectos/${p.id}`)}
        acciones={
          puede.gestionar
            ? (p) => (
                <AccionesEditarBorrar
                  onEditar={() => setForm({ abierto: true, registro: p })}
                  onEliminar={() => eliminacion.pedir(p.id, p.nombre)}
                />
              )
            : undefined
        }
        vacio={
          <EstadoVacio
            titulo="Sin proyectos"
            mensaje="Todo cuelga del proyecto: las torres, las cuadrillas y las metas. Empieza creando la obra."
            accion={puede.gestionar && <Boton onClick={abrirNuevo}>Crear el primero</Boton>}
          />
        }
      />

      <FormProyecto
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
        titulo="Eliminar proyecto"
        mensaje={`Se eliminara "${eliminacion.objetivo?.etiqueta}" con todas sus torres, pisos, zonas, frentes, cuadrillas y metas. Esta accion no se puede deshacer.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
