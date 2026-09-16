'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Campo, Entrada, Seleccion } from '@/components/ui/input'
import { AvisoError, PieFormulario, useEnvio } from './base'
import type { Usuario } from '@/types/dominio'
import { opcionesRol as ROLES } from '@/lib/dominio'

export function FormUsuario({
  abierto,
  registro,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  registro: Usuario | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { enviando, errorGeneral, errores, guardar } = useEnvio()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: 'RESIDENTE',
    activo: true,
  })

  useEffect(() => {
    if (!abierto) return
    setForm(
      registro
        ? {
            nombre: registro.nombre,
            apellido: registro.apellido,
            email: registro.email,
            password: '',
            rol: registro.rol,
            activo: registro.activo,
          }
        : { nombre: '', apellido: '', email: '', password: '', rol: 'RESIDENTE', activo: true },
    )
  }, [abierto, registro])

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    guardar(
      registro ? `/api/usuarios/${registro.id}` : '/api/usuarios',
      registro ? 'PUT' : 'POST',
      form,
      onGuardado,
    )
  }

  return (
    <Modal
      titulo={registro ? 'Editar usuario' : 'Nuevo usuario'}
      descripcion="Quien entra al sistema. Distinto del trabajador que ejecuta en obra."
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarFormulario} className="space-y-4">
        <AvisoError mensaje={errorGeneral} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" error={errores.nombre} requerido>
            <Entrada
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </Campo>
          <Campo etiqueta="Apellido" error={errores.apellido} requerido>
            <Entrada
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              required
            />
          </Campo>
        </div>

        <Campo etiqueta="Correo" error={errores.email} requerido>
          <Entrada
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Campo>

        <Campo
          etiqueta={registro ? 'Nueva contrasena' : 'Contrasena'}
          error={errores.password}
          requerido={!registro}
        >
          <Entrada
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={registro ? 'Dejar en blanco para no cambiarla' : 'Minimo 8 caracteres'}
            required={!registro}
          />
        </Campo>

        <Campo etiqueta="Rol" error={errores.rol} requerido>
          <Seleccion value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.texto}
              </option>
            ))}
          </Seleccion>
        </Campo>

        <label className="flex items-center gap-2 text-sm text-obra-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            className="h-4 w-4 rounded border-obra-300 text-obra-900 focus:ring-acento-500"
          />
          Cuenta activa
        </label>

        <PieFormulario enviando={enviando} onCancelar={onCerrar} />
      </form>
    </Modal>
  )
}
