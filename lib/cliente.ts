'use client'

import { useCallback, useEffect, useState } from 'react'

export type ErrorCampo = { campo: string; mensaje: string }

export type Respuesta<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campos?: ErrorCampo[]; codigo?: string }

/** fetch con respuesta de forma fija: { ok, datos } o { ok: false, error }. */
export async function pedir<T>(url: string, opciones?: RequestInit): Promise<Respuesta<T>> {
  try {
    const respuesta = await fetch(url, {
      // Sin cache: siempre datos actuales.
      cache: 'no-store',
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
        codigo: typeof cuerpo?.codigo === 'string' ? cuerpo.codigo : undefined,
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

/** Lista de un recurso con su estado de carga. Con url null no consulta. */
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
 * Devuelve el valor solo cuando deja de cambiar por unos ms.
 * Evita consultar en cada tecla (por ejemplo, en filtros de fecha).
 */
export function useRetardo<T>(valor: T, milisegundos = 350): T {
  const [retrasado, setRetrasado] = useState(valor)

  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), milisegundos)
    return () => clearTimeout(t)
  }, [valor, milisegundos])

  return retrasado
}

/** Recarga los datos al volver a la pestana. */
export function useRefrescoAlVolver(recargar: () => void) {
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') recargar()
    }
    window.addEventListener('focus', alVolver)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.removeEventListener('focus', alVolver)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [recargar])
}

/** Errores por campo -> objeto { campo: mensaje }. */
export function mapaDeErrores(campos?: ErrorCampo[]) {
  const mapa: Record<string, string> = {}
  for (const c of campos || []) mapa[c.campo] = c.mensaje
  return mapa
}

/** Borrado con confirmacion, usado por todas las pantallas. */
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

/** Como useRecurso, pero para una sola respuesta (un detalle, el panel...). */
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

  /** Recarga sin mostrar el indicador de carga. */
  const recargarEnSilencio = useCallback(() => traer(true), [traer])

  useEffect(() => {
    cargar()
  }, [cargar])

  /** Cambia los datos en pantalla sin ir al servidor. */
  const actualizar = useCallback((cambio: (previo: T) => T) => {
    setDato((previo) => (previo === null ? previo : cambio(previo)))
  }, [])

  return { dato, cargando, error, recargar: cargar, recargarEnSilencio, actualizar }
}
