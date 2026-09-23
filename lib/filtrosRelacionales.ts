/**
 * Filtros que se condicionan entre si, como los segmentadores del Excel.
 *
 * La idea: una opcion esta disponible en un filtro si existe al menos un
 * registro que la tiene y que ademas cumple todos los demas filtros elegidos.
 * Asi, al elegir la Torre B los pisos, las zonas, las cuadrillas y los
 * trabajadores se reducen a los que de verdad trabajaron ahi.
 *
 * Todo se calcula en el navegador a partir de una lista pequena de
 * combinaciones (zona, actividad, cuadrilla, trabajador) que llega una sola vez
 * con los catalogos. Elegir un filtro no vuelve a preguntarle nada a la base.
 *
 * Las fechas no entran aqui a proposito: acotan el panel, pero no deciden que
 * opciones se ofrecen. Si entraran, estrechar el rango podria dejar sin
 * disponibles a los filtros ya elegidos y borrarlos sin que el residente lo
 * pidiera.
 */
import type { Catalogos } from "@/types/dominio";

export const DIMENSIONES = [
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

/** Lo elegido en cada filtro, como texto: '' significa sin filtro. */
export type Seleccion = Record<Dimension, string>;

/** Un registro reducido a los identificadores de cada dimension. */
export type Fila = Record<Dimension, number | null>;

/**
 * Cuando dos filtros elegidos se contradicen, se suelta primero el mas
 * especifico: si cambias de torre, la zona de la torre anterior es la que
 * sobra, no la torre que acabas de elegir.
 */
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

/**
 * Completa cada combinacion con la torre, el piso, el proyecto y el cargo que
 * le corresponden, subiendo por la jerarquia del catalogo.
 */
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
      // Un registro puede no tener trabajador; entonces tampoco tiene cargo.
      cargoId:
        trabajadorId != null
          ? (trabajadores.get(trabajadorId)?.cargoId ?? null)
          : null,
    });
  }
  return filas;
}

/** Los filtros puestos, con su valor ya convertido a numero. */
function puestos(seleccion: Seleccion): Array<[Dimension, number]> {
  const lista: Array<[Dimension, number]> = [];
  for (const d of DIMENSIONES) {
    const valor = Number(seleccion[d]);
    if (seleccion[d] && Number.isFinite(valor)) lista.push([d, valor]);
  }
  return lista;
}

/**
 * Para cada filtro, los identificadores que tienen al menos un registro
 * compatible con TODOS LOS DEMAS filtros elegidos.
 *
 * El filtro propio no cuenta al calcular sus opciones: por eso, con la Torre B
 * elegida, la lista de torres sigue ofreciendo la A y la C, y se puede cambiar
 * de idea sin pasar por Limpiar.
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
 * Deja la seleccion sin contradicciones despues de un cambio.
 *
 * Si ningun registro cumple todo lo elegido, va soltando filtros en
 * ORDEN_DE_LIMPIEZA hasta que exista alguno. Los filtros que el usuario acaba
 * de tocar (`fijos`) nunca se sueltan: lo que se acaba de elegir manda sobre lo
 * que estaba puesto de antes.
 *
 * Suelta uno a uno y vuelve a comprobar, en vez de vaciar todo lo que choca,
 * para conservar el mayor numero posible de filtros.
 */
export function conciliar<T extends Seleccion>(
  filas: Fila[],
  seleccion: T,
  fijos: readonly string[] = [],
): T {
  // Sin combinaciones no hay con que juzgar: los catalogos aun no llegan, o la
  // obra no tiene registros.
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
  return resultado;
}
