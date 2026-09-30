'use client'

import { useState } from 'react'
import { Loader2, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
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
  /**
   * Rechazos que no son un campo mal llenado sino una regla que impide guardar
   * (por ejemplo, un trabajador sin precio acordado). Se muestran en una
   * ventana de error encima del formulario, no como un aviso mas.
   */
  const [ventanaError, setVentanaError] = useState('')

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

/**
 * Ventana de error encima del formulario: la regla que impide guardar, con una
 * X roja para que no se confunda con un aviso. El formulario queda detras tal
 * como estaba, para corregir y volver a intentar.
 */
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
 * Cabecera de un formulario que se llena por pasos.
 *
 * Existe porque estos formularios tienen dos mitades con naturalezas distintas:
 * primero se decide QUE se va a hacer y DONDE, y de esa decision depende como
 * se pide el resto (la unidad de medida sale de la actividad). Mostrarlo todo
 * de una vez obligaba a pedir "m2" antes de saber si el trabajo se mide en m2.
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

/**
 * Pie de un formulario por pasos: en el primero ofrece Cancelar y Siguiente; en
 * el ultimo, Atras y Guardar.
 */
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
  /** Falso mientras falte algo del paso actual: el boton Siguiente espera. */
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
          Las claves distintas no son decorativas: sin ellas React ve dos veces
          el mismo <Boton> en la misma posicion y reaprovecha el nodo del DOM,
          cambiandole el type de "button" a "submit". El navegador todavia tiene
          ese clic entre manos, ve un boton de envio y guarda el formulario a
          medio llenar. Con claves distintas se desmonta uno y se monta el otro,
          asi que el boton pulsado sigue siendo el de "Siguiente".
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
