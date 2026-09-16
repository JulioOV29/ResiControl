'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { enviar, mapaDeErrores } from '@/lib/cliente'
import { Boton } from '@/components/ui/button'

/**
 * Estado compartido por todos los formularios: envio en curso, error general y
 * errores por campo tal como los devuelve la validacion del servidor.
 */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})

  const guardar = async (
    url: string,
    metodo: 'POST' | 'PUT',
    datos: unknown,
    // Recibe lo que devolvio el servidor, para que la pantalla pueda pintar la
    // fila nueva sin esperar a recargar la lista entera.
    onExito: (creado: unknown) => void,
  ) => {
    setEnviando(true)
    setErrorGeneral('')
    setErrores({})

    const respuesta = await enviar(url, metodo, datos)

    if (respuesta.ok) {
      onExito(respuesta.datos)
    } else {
      setErrorGeneral(respuesta.error)
      setErrores(mapaDeErrores(respuesta.campos))
    }
    setEnviando(false)
  }

  return { enviando, errorGeneral, errores, guardar }
}

export function AvisoError({ mensaje }: { mensaje: string }) {
  if (!mensaje) return null
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {mensaje}
    </div>
  )
}

export function PieFormulario({
  enviando,
  onCancelar,
  textoGuardar = 'Guardar',
  error,
}: {
  enviando: boolean
  onCancelar: () => void
  textoGuardar?: string
  /** El mismo error de arriba, repetido junto al boton: en un formulario largo
   *  el aviso de la cabecera queda fuera de pantalla y parece que no paso nada. */
  error?: string
}) {
  return (
    <div className="space-y-3 pt-2">
      <AvisoError mensaje={error || ''} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Boton type="button" variante="contorno" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {enviando ? 'Guardando...' : textoGuardar}
        </Boton>
      </div>
    </div>
  )
}
