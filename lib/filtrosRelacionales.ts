/**
 * Filtros que se condicionan entre si, como los segmentadores de Excel.
 *
 * Una opcion se ofrece si hay al menos un registro con ella que cumpla los
 * demas filtros elegidos. Todo se calcula en el navegador con la lista de
 * combinaciones que llega con los catalogos.
 * Las fechas no participan. Lo que aun no tiene registros se ofrece siempre.
 */
import type { Catalogos } from "@/types/dominio";

const DIMENSIONES = [
  "proyectoId",
  "torreId",
  "pisoId",
  "zonaId",
  "actividadId",
  "cuadrillaId",
  "trabajadorId",
  "cargoId",
] as const;

export type Dimension = (typeof DIMENSIONES)[number];

/** Lo elegido en cada filtro ('' = sin filtro). */
export type Seleccion = Record<Dimension, string>;

/** Un registro reducido a los ids de cada dimension. */
export type Fila = Record<Dimension, number | null>;

/** Orden en que se sueltan filtros que chocan: primero el mas especifico. */
const ORDEN_DE_LIMPIEZA: Dimension[] = [
  "zonaId",
  "pisoId",
  "torreId",
  "proyectoId",
  "trabajadorId",
  "cuadrillaId",
  "cargoId",
  "actividadId",
];

/** Completa cada combinacion con torre, piso, proyecto y cargo. */
export function expandirFilas(
  catalogos: Pick<Catalogos, "torres" | "pisos" | "zonas" | "trabajadores">,
  combinaciones: Array<[number, number, number, number | null]>,
): Fila[] {
  const torres = new Map(catalogos.torres.map((t) => [t.id, t]));
  const pisos = new Map(catalogos.pisos.map((p) => [p.id, p]));
  const zonas = new Map(catalogos.zonas.map((z) => [z.id, z]));
  const trabajadores = new Map(catalogos.trabajadores.map((t) => [t.id, t]));

  const filas: Fila[] = [];
  for (const [
    zonaId,
    actividadId,
    cuadrillaId,
    trabajadorId,
  ] of combinaciones) {
    const zona = zonas.get(zonaId);
    const piso = zona ? pisos.get(zona.pisoId) : undefined;
    const torre = piso ? torres.get(piso.torreId) : undefined;
    if (!zona || !piso || !torre) continue;

    filas.push({
      proyectoId: torre.proyectoId,
      torreId: torre.id,
      pisoId: piso.id,
      zonaId,
      actividadId,
      cuadrillaId,
      trabajadorId,
      // Sin trabajador no hay cargo.
      cargoId:
        trabajadorId != null
          ? (trabajadores.get(trabajadorId)?.cargoId ?? null)
          : null,
    });
  }
  return filas;
}

/**
 * Ids que aparecen en algun registro, sin mirar filtros.
 * Lo que no aparece (por ejemplo, una actividad nueva) se ofrece siempre.
 */
export function idsConRegistros(filas: Fila[]): Record<Dimension, Set<number>> {
  const resultado = {} as Record<Dimension, Set<number>>;
  for (const dimension of DIMENSIONES) {
    const ids = new Set<number>();
    for (const fila of filas) {
      const valor = fila[dimension];
      if (valor !== null) ids.add(valor);
    }
    resultado[dimension] = ids;
  }
  return resultado;
}

/** Filtros puestos, con su valor como numero. */
function puestos(seleccion: Seleccion): Array<[Dimension, number]> {
  const lista: Array<[Dimension, number]> = [];
  for (const d of DIMENSIONES) {
    const valor = Number(seleccion[d]);
    if (seleccion[d] && Number.isFinite(valor)) lista.push([d, valor]);
  }
  return lista;
}

/**
 * Para cada filtro, los ids compatibles con los DEMAS filtros elegidos.
 * El propio filtro no cuenta, asi se puede cambiar de opcion sin limpiar.
 */
export function opcionesDisponibles(
  filas: Fila[],
  seleccion: Seleccion,
): Record<Dimension, Set<number>> {
  const activos = puestos(seleccion);

  const resultado = {} as Record<Dimension, Set<number>>;
  for (const dimension of DIMENSIONES) {
    const otros = activos.filter(([d]) => d !== dimension);
    const ids = new Set<number>();
    for (const fila of filas) {
      const valor = fila[dimension];
      if (valor === null || ids.has(valor)) continue;
      if (otros.every(([d, v]) => fila[d] === v)) ids.add(valor);
    }
    resultado[dimension] = ids;
  }
  return resultado;
}

/**
 * Quita contradicciones tras un cambio: suelta filtros uno a uno, en
 * ORDEN_DE_LIMPIEZA, hasta que haya registros. Nunca suelta los `fijos`
 * (los que el usuario acaba de tocar).
 */
export function conciliar<T extends Seleccion>(
  filas: Fila[],
  seleccion: T,
  fijos: readonly string[] = [],
): T {
  // Sin combinaciones no hay como juzgar.
  if (filas.length === 0) return seleccion;

  const resultado = { ...seleccion };
  const hayRegistro = () => {
    const activos = puestos(resultado);
    return filas.some((fila) => activos.every(([d, v]) => fila[d] === v));
  };

  for (const dimension of ORDEN_DE_LIMPIEZA) {
    if (hayRegistro()) break;
    if (resultado[dimension] && !fijos.includes(dimension)) {
      resultado[dimension] = "" as T[Dimension];
    }
  }

  // Si no se llega a ninguna combinacion, se deja la seleccion como estaba.
  return hayRegistro() ? resultado : seleccion;
}
