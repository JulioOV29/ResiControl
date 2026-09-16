'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRecurso, useEliminacion } from '@/lib/cliente'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Insignia } from '@/components/ui/badge'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { FormUsuario } from '@/components/formularios/FormUsuario'
import { formatoFecha } from '@/lib/utils'
import type { Rol, Usuario } from '@/types/dominio'

const TONO_ROL: Record<Rol, 'peligro' | 'info' | 'neutro'> = {
  ADMIN: 'peligro',
  RESIDENTE: 'info',
  SUPERVISOR: 'neutro',
}

const TEXTO_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  RESIDENTE: 'Residente',
  SUPERVISOR: 'Supervisor',
}

export default function UsuariosPage() {
  const { datos, cargando, recargar } = useRecurso<Usuario>('/api/usuarios')
  const eliminacion = useEliminacion('/api/usuarios', recargar)
  const [form, setForm] = useState<{ abierto: boolean; registro: Usuario | null }>({
    abierto: false,
    registro: null,
  })

  const abrirNuevo = () => setForm({ abierto: true, registro: null })

  const columnas: Columna<Usuario>[] = [
    { clave: 'nombre', titulo: 'Usuario', render: (u) => `${u.apellido} ${u.nombre}` },
    { clave: 'email', titulo: 'Correo', render: (u) => u.email },
    {
      clave: 'rol',
      titulo: 'Rol',
      render: (u) => <Insignia tono={TONO_ROL[u.rol]}>{TEXTO_ROL[u.rol]}</Insignia>,
    },
    {
      clave: 'creado',
      titulo: 'Creado',
      soloEscritorio: true,
      render: (u) => formatoFecha(u.createdAt),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (u) => (
        <Insignia tono={u.activo ? 'exito' : 'neutro'}>{u.activo ? 'Activo' : 'Inactivo'}</Insignia>
      ),
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas de acceso al sistema y sus roles."
        acciones={
          <Boton onClick={abrirNuevo}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Boton>
        }
      />

      <Tabla
        columnas={columnas}
        filas={datos}
        cargando={cargando}
        acciones={(u) => (
          <AccionesEditarBorrar
            onEditar={() => setForm({ abierto: true, registro: u })}
            onEliminar={() => eliminacion.pedir(u.id, `${u.nombre} ${u.apellido}`)}
          />
        )}
        vacio={
          <EstadoVacio
            titulo="Sin usuarios"
            mensaje="Crea cuentas para los residentes y supervisores que van a usar el sistema."
            accion={<Boton onClick={abrirNuevo}>Crear el primero</Boton>}
          />
        }
      />

      <FormUsuario
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
        titulo="Eliminar usuario"
        mensaje={`Se eliminara la cuenta de ${eliminacion.objetivo?.etiqueta}. Si ya registro ejecuciones, la base lo va a impedir: desactivala en lugar de borrarla.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
