'use client'

import { useCallback, useEffect, useState } from 'react'

export type ErrorCampo = { campo: string; mensaje: string }

export type Respuesta<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campos?: ErrorCampo[] }

/**
 * Envoltura unica de fetch: traduce cualquier respuesta de la API a un
 * resultado con forma fija, para que ninguna pantalla tenga que repetir el
 * manejo de errores ni adivinar la forma del cuerpo.
 */
export async function pedir<T>(url: string, opciones?: RequestInit): Promise<Respuesta<T>> {
  try {
    const respuesta = await fetch(url, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        ...(opciones?.headers || {}),
      },
    })

    const texto = await respuesta.text()
    const cuerpo = texto ? JSON.parse(texto) : null

    if (!respuesta.ok) {
      return {
        ok: false,
        error: cuerpo?.error || 'No se pudo completar la operacion',
        campos: Array.isArray(cuerpo?.detalle) ? cuerpo.detalle : undefined,
      }
    }

    return { ok: true, datos: cuerpo as T }
  } catch {
    return { ok: false, error: 'No hay conexion con el servidor' }
  }
}

export function enviar<T>(url: string, metodo: 'POST' | 'PUT' | 'PATCH', datos: unknown) {
  return pedir<T>(url, { method: metodo, body: JSON.stringify(datos) })
}

export function borrar(url: string) {
  return pedir<{ mensaje: string }>(url, { method: 'DELETE' })
}

/**
 * Lista de un recurso con su estado de carga. Si la url es null no consulta
 * nada, lo que sirve para listas que dependen de una seleccion previa (los
 * pisos de una torre, las zonas de un piso).
 */
export function useRecurso<T>(url: string | null) {
  const [datos, setDatos] = useState<T[]>([])
  const [cargando, setCargando] = useState(Boolean(url))
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!url) {
      setDatos([])
      setCargando(false)
      return
    }
    setCargando(true)
    const respuesta = await pedir<T[]>(url)
    if (respuesta.ok) {
      setDatos(respuesta.datos)
      setError('')
    } else {
      setDatos([])
      setError(respuesta.error)
    }
    setCargando(false)
  }, [url])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { datos, cargando, error, recargar: cargar }
}

/**
 * Retrasa un valor hasta que deja de cambiar durante unos milisegundos.
 *
 * Los filtros de fecha son la razon: un <input type="date"> dispara onChange en
 * cada parte que se escribe, asi que teclear "2026-09-15" lanzaba varias
 * consultas del panel seguidas, cada una recalculando todos los indicadores
 * contra la base, y solo servia la ultima. Con esto se lanza una.
 */
export function useRetardo<T>(valor: T, milisegundos = 350): T {
  const [retrasado, setRetrasado] = useState(valor)

  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), milisegundos)
    return () => clearTimeout(t)
  }, [valor, milisegundos])

  return retrasado
}

/** Convierte la lista de errores por campo en un objeto para el formulario. */
export function mapaDeErrores(campos?: ErrorCampo[]) {
  const mapa: Record<string, string> = {}
  for (const c of campos || []) mapa[c.campo] = c.mensaje
  return mapa
}

/**
 * Flujo de borrado con confirmacion, compartido por todas las pantallas: pedir,
 * confirmar, mostrar el motivo cuando el servidor lo rechaza por integridad.
 */
export function useEliminacion(baseUrl: string, alTerminar: () => void) {
  const [objetivo, setObjetivo] = useState<{ id: number; etiqueta: string } | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  const pedir = (id: number, etiqueta: string) => {
    setObjetivo({ id, etiqueta })
    setError('')
  }

  const cancelar = () => {
    setObjetivo(null)
    setError('')
  }

  const confirmar = async () => {
    if (!objetivo) return
    setProcesando(true)
    const respuesta = await borrar(`${baseUrl}/${objetivo.id}`)
    setProcesando(false)

    if (respuesta.ok) {
      setObjetivo(null)
      alTerminar()
    } else {
      setError(respuesta.error)
    }
  }

  return { objetivo, procesando, error, pedir, cancelar, confirmar }
}

/**
 * Igual que useRecurso pero para una sola respuesta: el detalle de un registro,
 * el panel, o una lista que viene acompañada de su resumen.
 */
export function useRecursoUnico<T>(url: string | null) {
  const [dato, setDato] = useState<T | null>(null)
  const [cargando, setCargando] = useState(Boolean(url))
  const [error, setError] = useState('')

  const traer = useCallback(
    async (silencioso: boolean) => {
      if (!url) {
        setDato(null)
        setCargando(false)
        return
      }
      if (!silencioso) setCargando(true)
      const respuesta = await pedir<T>(url)
      if (respuesta.ok) {
        setDato(respuesta.datos)
        setError('')
      } else {
        if (!silencioso) setDato(null)
        setError(respuesta.error)
      }
      setCargando(false)
    },
    [url],
  )

  const cargar = useCallback(() => traer(false), [traer])

  /**
   * Recarga sin encender el indicador de carga ni vaciar lo que ya se ve. Sirve
   * para refrescar despues de guardar: la fila nueva ya esta puesta en
   * pantalla, y esto solo pone al dia las cifras que dependen del resto.
   */
  const recargarEnSilencio = useCallback(() => traer(true), [traer])

  useEffect(() => {
    cargar()
  }, [cargar])

  /** Cambia lo que se ve sin ir al servidor, para reflejar algo al instante. */
  const actualizar = useCallback((cambio: (previo: T) => T) => {
    setDato((previo) => (previo === null ? previo : cambio(previo)))
  }, [])

  return { dato, cargando, error, recargar: cargar, recargarEnSilencio, actualizar }
}
