import type { Catalogos } from '@/types/dominio'

/**
 * Como se escriben las opciones de los filtros y de los formularios.
 *
 * Todo lo que cuelga de un proyecto lleva su codigo detras de un guion:
 * "Torre 1 - PRY-081", "Cuadrilla 1 - PRY-001". Con varias obras abiertas, una
 * lista de torres o de cuadrillas a secas no dice de cual es cada una, y es el
 * mismo problema que ya tenia el "Apto 305" repetido entre torres.
 *
 * Vive aparte de las pantallas porque el panel, la pantalla de ejecucion y los
 * formularios de registro tienen que escribirlas igual: si cada uno arma su
 * texto, acaban discrepando.
 */

type CatalogosUbicacion = Pick<Catalogos, 'proyectos' | 'torres' | 'pisos'>

/** Une un texto con el codigo de su proyecto, si se conoce. */
export function conProyecto(texto: string, codigoProyecto?: string | null) {
  return codigoProyecto ? `${texto} - ${codigoProyecto}` : texto
}

export function crearEtiquetas(catalogos?: CatalogosUbicacion | null) {
  const proyectos = new Map((catalogos?.proyectos ?? []).map((p) => [p.id, p]))
  const torres = new Map((catalogos?.torres ?? []).map((t) => [t.id, t]))
  const pisos = new Map((catalogos?.pisos ?? []).map((p) => [p.id, p]))

  /** El codigo del proyecto, que es lo que va detras del guion. */
  const codigoProyecto = (proyectoId?: number | null) =>
    proyectoId == null ? null : (proyectos.get(proyectoId)?.codigo ?? null)

  const proyectoDeTorre = (torreId?: number | null) =>
    torreId == null ? null : codigoProyecto(torres.get(torreId)?.proyectoId)

  const proyectoDePiso = (pisoId?: number | null) =>
    pisoId == null ? null : proyectoDeTorre(pisos.get(pisoId)?.torreId)

  const nombrePiso = (piso: { numero: number; nombre: string | null }) =>
    piso.nombre || `Piso ${piso.numero}`

  return {
    codigoProyecto,
    proyectoDeTorre,
    proyectoDePiso,
    nombrePiso,

    /** "Torre 1 - PRY-081" */
    torre: (torre: { proyectoId: number; nombre: string }) =>
      conProyecto(torre.nombre, codigoProyecto(torre.proyectoId)),

    /**
     * "Piso 3 - PRY-081", y con la torre delante mientras el filtro de arriba
     * no la precise: "Torre 1 - Piso 3 - PRY-081".
     */
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
     * "Apto 305 - PRY-081", con torre y piso delante mientras los filtros de
     * arriba no los precisen. Es el caso del "Apto 305" que existe en varias
     * torres.
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

export type Etiquetas = ReturnType<typeof crearEtiquetas>
