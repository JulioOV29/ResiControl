'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRecurso, useEliminacion } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { FormCargo } from '@/components/formularios/FormCargo'
import type { Cargo } from '@/types/dominio'

export default function CargosPage() {
  const { datos, cargando, recargar } = useRecurso<Cargo>('/api/cargos')
  const puede = usePuede()
  const eliminacion = useEliminacion('/api/cargos', recargar)
  const [form, setForm] = useState<{ abierto: boolean; registro: Cargo | null }>({
    abierto: false,
    registro: null,
  })

  const abrirNuevo = () => setForm({ abierto: true, registro: null })

  const columnas: Columna<Cargo>[] = [
    { clave: 'nombre', titulo: 'Cargo', render: (c) => c.nombre },
    {
      clave: 'descripcion',
      titulo: 'Descripcion',
      soloEscritorio: true,
      render: (c) => c.descripcion || <span className="text-obra-400">-</span>,
    },
    {
      clave: 'trabajadores',
      titulo: 'Trabajadores',
      alineacion: 'derecha',
      render: (c) => c._count?.trabajadores ?? 0,
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Cargos"
        descripcion="Catalogo de cargos del personal de obra."
        acciones={
          puede.gestionar && (
            <Boton onClick={abrirNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo cargo
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
            titulo="Sin cargos"
            mensaje="El cargo define el rol del trabajador en obra y permite fijar metas distintas por oficio."
            accion={puede.gestionar && <Boton onClick={abrirNuevo}>Crear el primero</Boton>}
          />
        }
      />

      <FormCargo
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
        titulo="Eliminar cargo"
        mensaje={`Se eliminara "${eliminacion.objetivo?.etiqueta}". No se puede si tiene trabajadores asociados.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
