'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BotonIcono({
  icono: Icono,
  titulo,
  onClick,
  tono = 'neutro',
}: {
  icono: React.ComponentType<{ className?: string }>
  titulo: string
  onClick: () => void
  tono?: 'neutro' | 'peligro'
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={cn(
        'rounded-lg p-2 transition-colors',
        tono === 'peligro'
          ? 'text-obra-400 hover:bg-red-50 hover:text-red-600'
          : 'text-obra-400 hover:bg-obra-100 hover:text-obra-700',
      )}
    >
      <Icono className="h-4 w-4" />
    </button>
  )
}

export function AccionesEditarBorrar({
  onEditar,
  onEliminar,
}: {
  onEditar: () => void
  onEliminar: () => void
}) {
  return (
    <>
      <BotonIcono icono={Pencil} titulo="Editar" onClick={onEditar} />
      <BotonIcono icono={Trash2} titulo="Eliminar" onClick={onEliminar} tono="peligro" />
    </>
  )
}
