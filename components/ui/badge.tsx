import { cn } from '@/lib/utils'

const tonos = {
  neutro: 'bg-obra-100 text-obra-600',
  exito: 'bg-menta-50 text-menta-700',
  aviso: 'bg-acento-50 text-acento-700',
  peligro: 'bg-red-50 text-red-700',
  info: 'bg-marca-50 text-marca-700',
} as const

export type Tono = keyof typeof tonos

export function Insignia({
  children,
  tono = 'neutro',
}: {
  children: React.ReactNode
  tono?: Tono
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium leading-none',
        tonos[tono],
      )}
    >
      {children}
    </span>
  )
}

/** Tono de color de cada estado. */
export function tonoEstado(estado: string): Tono {
  switch (estado) {
    case 'TERMINADO':
    case 'FINALIZADO':
      return 'exito'
    case 'EN_PROCESO':
    case 'EN_EJECUCION':
      return 'info'
    case 'SUSPENDIDO':
      return 'peligro'
    default:
      return 'neutro'
  }
}

/** Texto legible de un estado. */
export function textoEstado(estado: string) {
  return estado.charAt(0) + estado.slice(1).toLowerCase().replace(/_/g, ' ')
}
