import * as React from 'react'
import { cn } from '@/lib/utils'

export const Entrada = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn('campo', className)} {...props} />,
)
Entrada.displayName = 'Entrada'

export const Seleccion = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('campo appearance-none pr-8', className)} {...props} />
))
Seleccion.displayName = 'Seleccion'

export const AreaTexto = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('campo min-h-[80px] resize-y', className)} {...props} />
))
AreaTexto.displayName = 'AreaTexto'

export function Etiqueta({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('etiqueta', className)} {...props} />
}

/** Campo de formulario completo: etiqueta, control y mensaje de error. */
export function Campo({
  etiqueta,
  htmlFor,
  error,
  requerido,
  children,
  className,
}: {
  etiqueta: string
  htmlFor?: string
  error?: string
  requerido?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Etiqueta htmlFor={htmlFor}>
        {etiqueta}
        {requerido && <span className="ml-0.5 text-red-500">*</span>}
      </Etiqueta>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
