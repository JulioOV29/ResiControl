import * as React from 'react'
import { cn } from '@/lib/utils'

type Variante = 'primario' | 'secundario' | 'contorno' | 'peligro' | 'fantasma'
type Tamano = 'sm' | 'md' | 'lg' | 'icono'

const variantes: Record<Variante, string> = {
  primario:
    'bg-marca-600 text-white shadow-sm shadow-marca-600/20 hover:bg-marca-700 focus-visible:ring-marca-500',
  secundario: 'bg-marca-50 text-marca-700 hover:bg-marca-100 focus-visible:ring-marca-400',
  contorno:
    'border border-obra-200 bg-white text-obra-700 hover:border-obra-300 hover:bg-obra-50 focus-visible:ring-obra-400',
  peligro: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
  fantasma: 'text-obra-600 hover:bg-obra-100 hover:text-obra-900 focus-visible:ring-obra-400',
}

const tamanos: Record<Tamano, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-sm',
  icono: 'h-9 w-9',
}

export interface BotonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
}

export const Boton = React.forwardRef<HTMLButtonElement, BotonProps>(
  ({ className, variante = 'primario', tamano = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variantes[variante],
        tamanos[tamano],
        className,
      )}
      {...props}
    />
  ),
)
Boton.displayName = 'Boton'
