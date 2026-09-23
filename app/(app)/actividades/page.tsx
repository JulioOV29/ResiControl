'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRecurso, useEliminacion } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Insignia } from '@/components/ui/badge'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { FormActividad } from '@/components/formularios/FormActividad'
import type { Actividad } from '@/types/dominio'

export default function ActividadesPage() {
  const { datos, cargando, recargar } = useRecurso<Actividad>('/api/actividades')
  const puede = usePuede()
  const eliminacion = useEliminacion('/api/actividades', recargar)
  const [form, setForm] = useState<{ abierto: boolean; registro: Actividad | null }>({
    abierto: false,
    registro: null,
  })

  const abrirNuevo = () => setForm({ abierto: true, registro: null })

  const columnas: Columna<Actividad>[] = [
    { clave: 'nombre', titulo: 'Actividad', render: (a) => a.nombre },
    { clave: 'unidad', titulo: 'Unidad', render: (a) => a.unidadMedida },
    {
      clave: 'descripcion',
      titulo: 'Descripcion',
      soloEscritorio: true,
      render: (a) => a.descripcion || <span className="text-obra-400">-</span>,
    },
    {
      clave: 'uso',
      titulo: 'Registros',
      alineacion: 'derecha',
      render: (a) => a._count?.registros ?? 0,
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (a) => (
        <Insignia tono={a.activo ? 'exito' : 'neutro'}>{a.activo ? 'Activa' : 'Inactiva'}</Insignia>
      ),
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Actividades"
        antetitulo="Catalogos"
        descripcion="Que se ejecuta sobre cada frente, en que unidad se mide y a cuanto se paga la unidad."
        acciones={
          puede.gestionar && (
            <Boton onClick={abrirNuevo}>
              <Plus className="h-4 w-4" />
              Nueva actividad
            </Boton>
          )
        }
      />

      <Tabla
        columnas={columnas}
        filas={datos}
        cargando={cargando}
        acciones={
          puede.gestionar
            ? (a) => (
                <AccionesEditarBorrar
                  onEditar={() => setForm({ abierto: true, registro: a })}
                  onEliminar={() => eliminacion.pedir(a.id, a.nombre)}
                />
              )
            : undefined
        }
        vacio={
          <EstadoVacio
            titulo="Sin actividades"
            mensaje="Las actividades son lo que se ejecuta sobre cada frente de trabajo: panete, estuco, mamposteria, pintura."
            accion={puede.gestionar && <Boton onClick={abrirNuevo}>Crear la primera</Boton>}
          />
        }
      />

      <FormActividad
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
        titulo="Eliminar actividad"
        mensaje={`Se eliminara "${eliminacion.objetivo?.etiqueta}". Si tiene registros o metas asociadas, la base de datos lo va a impedir.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
