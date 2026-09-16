'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Modal({
  titulo,
  descripcion,
  abierto,
  onCerrar,
  children,
  ancho = 'md',
}: {
  titulo: string
  descripcion?: string
  abierto: boolean
  onCerrar: () => void
  children: React.ReactNode
  ancho?: 'md' | 'lg' | 'xl'
}) {
  // Cerrar con Escape y bloquear el scroll del fondo mientras esta abierto.
  useEffect(() => {
    if (!abierto) return
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPresionar)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  const anchos = { md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onCerrar} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          anchos[ancho],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-obra-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-obra-900">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-sm text-obra-500">{descripcion}</p>}
          </div>
          <button
            onClick={onCerrar}
            className="-mr-1 rounded-lg p-1.5 text-obra-400 hover:bg-obra-100 hover:text-obra-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmarEliminacion({
  abierto,
  titulo,
  mensaje,
  procesando,
  error,
  onCancelar,
  onConfirmar,
}: {
  abierto: boolean
  titulo: string
  mensaje: string
  procesando?: boolean
  error?: string
  onCancelar: () => void
  onConfirmar: () => void
}) {
  return (
    <Modal titulo={titulo} abierto={abierto} onCerrar={onCancelar}>
      <p className="text-sm text-obra-600">{mensaje}</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          onClick={onCancelar}
          className="h-10 rounded-lg border border-obra-200 px-4 text-sm font-medium text-obra-700 hover:bg-obra-50"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={procesando}
          className="h-10 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {procesando ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  )
}
