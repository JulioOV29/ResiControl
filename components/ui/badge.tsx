import { cn } from '@/lib/utils'

const tonos = {
  neutro: 'bg-obra-100 text-obra-700',
  exito: 'bg-emerald-100 text-emerald-700',
  aviso: 'bg-acento-100 text-acento-800',
  peligro: 'bg-red-100 text-red-700',
  // Azul de marca y no el sky de Tailwind: es el mismo color de accion del menu
  // y de las graficas, para que "en proceso" se lea del mismo juego.
  info: 'bg-marca-50 text-marca-700',
} as const

export type Tono = keyof typeof tonos

export function Insignia({
  children,
  tono = 'neutro',
  className,
}: {
  children: React.ReactNode
  tono?: Tono
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tonos[tono],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Tono visual asociado a cada estado del dominio. */
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

/** Texto legible de los enums del dominio. */
export function textoEstado(estado: string) {
  return estado.charAt(0) + estado.slice(1).toLowerCase().replace(/_/g, ' ')
}
