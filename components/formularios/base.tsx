'use client'

import { useEffect, useState } from 'react'
import { Loader2, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { enviar, mapaDeErrores } from '@/lib/cliente'
import { Boton } from '@/components/ui/button'

/**
 * Estado comun de los formularios: envio, error general y errores por campo.
 * `abierto`: al abrir el formulario se borran los errores de la vez anterior.
 */
export function useEnvio(abierto?: boolean) {
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  /**
   * Errores que impiden guardar (ej. trabajador sin precio): se muestran en
   * una ventana de error encima del formulario.
   */
  const [ventanaError, setVentanaError] = useState('')

  useEffect(() => {
    if (!abierto) return
    setErrorGeneral('')
    setErrores({})
    setVentanaError('')
  }, [abierto])

  const guardar = async (
    url: string,
    metodo: 'POST' | 'PUT',
    datos: unknown,
    // Recibe lo que devolvio el servidor.
    onExito: (creado: unknown) => void,
  ) => {
    setEnviando(true)
    setErrorGeneral('')
    setErrores({})

    const respuesta = await enviar(url, metodo, datos)

    if (respuesta.ok) {
      onExito(respuesta.datos)
    } else if (respuesta.codigo) {
      setVentanaError(respuesta.error)
    } else {
      setErrorGeneral(respuesta.error)
      setErrores(mapaDeErrores(respuesta.campos))
    }
    setEnviando(false)
  }

  return {
    enviando,
    errorGeneral,
    errores,
    guardar,
    ventanaError,
    mostrarVentanaError: setVentanaError,
    cerrarVentanaError: () => setVentanaError(''),
  }
}

/** Ventana de error con una X roja, encima del formulario. */
export function VentanaError({
  mensaje,
  titulo = 'No se puede guardar',
  onCerrar,
}: {
  mensaje: string
  titulo?: string
  onCerrar: () => void
}) {
  return (
    <Modal titulo={titulo} abierto={Boolean(mensaje)} onCerrar={onCerrar}>
      <div role="alertdialog" className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-8 w-8 text-red-600" aria-hidden />
        </span>
        <p className="text-sm leading-relaxed text-obra-800">{mensaje}</p>
        <Boton type="button" className="mt-2 w-full sm:w-auto" onClick={onCerrar}>
          Entendido
        </Boton>
      </div>
    </Modal>
  )
}

export function AvisoError({ mensaje }: { mensaje: string }) {
  if (!mensaje) return null
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {mensaje}
    </div>
  )
}

/**
 * Indicador de pasos de un formulario.
 * Primero se elige que y donde; de eso depende el resto (por ejemplo, la unidad).
 */
export function Pasos({ actual, titulos }: { actual: number; titulos: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {titulos.map((titulo, i) => {
        const numero = i + 1
        const activo = numero === actual
        const hecho = numero < actual
        return (
          <li key={titulo} className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                activo
                  ? 'bg-marca-600 text-white'
                  : hecho
                    ? 'bg-marca-100 text-marca-700'
                    : 'bg-obra-100 text-obra-400'
              }`}
            >
              {numero}
            </span>
            <span className={activo ? 'font-medium text-obra-900' : 'text-obra-500'}>{titulo}</span>
            {numero < titulos.length && <span className="mx-1 h-px w-5 bg-obra-200" />}
          </li>
        )
      })}
    </ol>
  )
}

/** Pie de formulario por pasos: Cancelar/Siguiente y luego Atras/Guardar. */
export function PiePasos({
  paso,
  total,
  enviando,
  puedeSeguir,
  onCancelar,
  onAtras,
  onSiguiente,
  textoGuardar = 'Guardar',
  error,
}: {
  paso: number
  total: number
  enviando: boolean
  /** false mientras falte algo del paso actual. */
  puedeSeguir?: boolean
  onCancelar: () => void
  onAtras: () => void
  onSiguiente: () => void
  textoGuardar?: string
  error?: string
}) {
  const ultimo = paso >= total

  return (
    <div className="space-y-3 pt-2">
      <AvisoError mensaje={error || ''} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Boton
          type="button"
          variante="contorno"
          onClick={paso === 1 ? onCancelar : onAtras}
          disabled={enviando}
        >
          {paso === 1 ? 'Cancelar' : 'Atras'}
        </Boton>

        {/*
          Las keys distintas evitan que React reutilice el boton y lo convierta en
          submit a mitad del clic (guardaria el formulario incompleto).
        */}
        {ultimo ? (
          <Boton key="guardar" type="submit" disabled={enviando}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? 'Guardando...' : textoGuardar}
          </Boton>
        ) : (
          <Boton key="siguiente" type="button" onClick={onSiguiente} disabled={!puedeSeguir}>
            Siguiente
          </Boton>
        )}
      </div>
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
  /** El error se repite junto al boton para que se vea en formularios largos. */
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
