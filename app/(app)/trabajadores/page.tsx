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
import { FormTrabajador } from '@/components/formularios/FormTrabajador'
import { formatoMoneda } from '@/lib/utils'
import type { Trabajador } from '@/types/dominio'

export default function TrabajadoresPage() {
  const { datos, cargando, recargar } = useRecurso<Trabajador>('/api/trabajadores')
  const puede = usePuede()
  const eliminacion = useEliminacion('/api/trabajadores', recargar)
  const [form, setForm] = useState<{ abierto: boolean; registro: Trabajador | null }>({
    abierto: false,
    registro: null,
  })

  const abrirNuevo = () => setForm({ abierto: true, registro: null })

  const columnas: Columna<Trabajador>[] = [
    {
      clave: 'nombre',
      titulo: 'Trabajador',
      render: (t) => `${t.apellido} ${t.nombre}`,
    },
    {
      clave: 'documento',
      titulo: 'Documento',
      soloEscritorio: true,
      render: (t) => t.documento || <span className="text-obra-400">-</span>,
    },
    { clave: 'cargo', titulo: 'Cargo', render: (t) => t.cargo?.nombre ?? '-' },
    {
      clave: 'cuadrilla',
      titulo: 'Cuadrilla actual',
      render: (t) =>
        t.asignaciones?.[0]?.cuadrilla.nombre ?? <span className="text-obra-400">Sin asignar</span>,
    },
    {
      // Los precios se acuerdan con la persona, asi que se ven desde su ficha:
      // aqui basta con saber cuantas actividades tiene acordadas y a cuanto.
      clave: 'precios',
      titulo: 'Precios',
      soloEscritorio: true,
      render: (t) => {
        const tarifas = t.tarifas ?? []
        if (tarifas.length === 0) return <span className="text-obra-400">Sin precios</span>
        return (
          <span className="text-obra-700">
            {tarifas.length} actividad{tarifas.length === 1 ? '' : 'es'}
            <span className="ml-1 text-xs tabular-nums text-obra-400">
              {formatoMoneda(Math.min(...tarifas.map((x) => x.valorM2)))}
              {tarifas.length > 1 &&
                ` a ${formatoMoneda(Math.max(...tarifas.map((x) => x.valorM2)))}`}
            </span>
          </span>
        )
      },
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (t) => (
        <Insignia tono={t.activo ? 'exito' : 'neutro'}>{t.activo ? 'Activo' : 'Inactivo'}</Insignia>
      ),
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Trabajadores"
        descripcion="Personal que ejecuta las actividades. No necesita cuenta en el sistema."
        acciones={
          puede.gestionar && (
            <Boton onClick={abrirNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo trabajador
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
            ? (t) => (
                <AccionesEditarBorrar
                  onEditar={() => setForm({ abierto: true, registro: t })}
                  onEliminar={() => eliminacion.pedir(t.id, `${t.nombre} ${t.apellido}`)}
                />
              )
            : undefined
        }
        vacio={
          <EstadoVacio
            titulo="Sin trabajadores"
            mensaje="Registra el personal de obra para poder armar cuadrillas y medir su desempeno."
            accion={puede.gestionar && <Boton onClick={abrirNuevo}>Crear el primero</Boton>}
          />
        }
      />

      <FormTrabajador
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
        titulo="Eliminar trabajador"
        mensaje={`Se eliminara a ${eliminacion.objetivo?.etiqueta} y su historial de cuadrillas. Si prefieres conservar el historico, marcalo como inactivo en lugar de borrarlo.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
