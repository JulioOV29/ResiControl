import type { Catalogos } from '@/types/dominio'

/**
 * Textos de las opciones de filtros y formularios.
 * Lo que pertenece a un proyecto lleva su codigo: "Torre 1 - PRY-081".
 */

type CatalogosUbicacion = Pick<Catalogos, 'proyectos' | 'torres' | 'pisos'>

/** Agrega " · inactiva" a lo dado de baja. */
export function conBaja(texto: string, activo: boolean) {
  return activo ? texto : `${texto} · inactiva`
}

/** Agrega el codigo del proyecto, si se conoce. */
export function conProyecto(texto: string, codigoProyecto?: string | null) {
  return codigoProyecto ? `${texto} - ${codigoProyecto}` : texto
}

export function crearEtiquetas(catalogos?: CatalogosUbicacion | null) {
  const proyectos = new Map((catalogos?.proyectos ?? []).map((p) => [p.id, p]))
  const torres = new Map((catalogos?.torres ?? []).map((t) => [t.id, t]))
  const pisos = new Map((catalogos?.pisos ?? []).map((p) => [p.id, p]))

  /** Codigo del proyecto por su id. */
  const codigoProyecto = (proyectoId?: number | null) =>
    proyectoId == null ? null : (proyectos.get(proyectoId)?.codigo ?? null)

  const proyectoDeTorre = (torreId?: number | null) =>
    torreId == null ? null : codigoProyecto(torres.get(torreId)?.proyectoId)

  const proyectoDePiso = (pisoId?: number | null) =>
    pisoId == null ? null : proyectoDeTorre(pisos.get(pisoId)?.torreId)

  const nombrePiso = (piso: { numero: number; nombre: string | null }) =>
    piso.nombre || `Piso ${piso.numero}`

  return {
    /** "Torre 1 - PRY-081" */
    torre: (torre: { proyectoId: number; nombre: string }) =>
      conProyecto(torre.nombre, codigoProyecto(torre.proyectoId)),

    /** "Piso 3 - PRY-081", o "Torre 1 · Piso 3 - PRY-081" si se pide la torre. */
    piso: (
      piso: { torreId: number; numero: number; nombre: string | null },
      opciones?: { conTorre?: boolean },
    ) => {
      const torre = torres.get(piso.torreId)
      const texto = opciones?.conTorre
        ? `${torre?.nombre ?? '?'} · ${nombrePiso(piso)}`
        : nombrePiso(piso)
      return conProyecto(texto, proyectoDeTorre(piso.torreId))
    },

    /**
     * "Apto 305 - PRY-081", con torre y piso delante si se piden
     * (el mismo apartamento puede existir en varias torres).
     */
    zona: (
      zona: { pisoId: number; nombre: string },
      opciones?: { conTorre?: boolean; conPiso?: boolean },
    ) => {
      const piso = pisos.get(zona.pisoId)
      const partes: string[] = []
      if (opciones?.conTorre && piso) partes.push(torres.get(piso.torreId)?.nombre ?? '?')
      if (opciones?.conPiso && piso) partes.push(nombrePiso(piso))
      partes.push(zona.nombre)
      return conProyecto(partes.join(' · '), proyectoDePiso(zona.pisoId))
    },

    /** "Cuadrilla 1 - PRY-001" */
    cuadrilla: (cuadrilla: { proyectoId: number; nombre: string }) =>
      conProyecto(cuadrilla.nombre, codigoProyecto(cuadrilla.proyectoId)),
  }
}

