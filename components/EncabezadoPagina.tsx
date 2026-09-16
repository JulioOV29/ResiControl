/**
 * Encabezado de pagina.
 *
 * El antetitulo es la linea pequeña en mayusculas encima del titulo. Dice en
 * que parte del sistema esta parado el residente, que es lo que se responde de
 * un vistazo, y deja el titulo libre para decir que se esta viendo.
 */
export function EncabezadoPagina({
  antetitulo,
  titulo,
  descripcion,
  meta,
  acciones,
}: {
  antetitulo?: string
  titulo: string
  descripcion?: string
  /** Linea de datos sueltos bajo el titulo: fechas, estado, conteos. */
  meta?: React.ReactNode
  acciones?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {antetitulo && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-marca-700">
            {antetitulo}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-obra-900 sm:text-[28px]">
          {titulo}
        </h1>
        {descripcion && <p className="mt-1.5 text-sm text-obra-500">{descripcion}</p>}
        {meta && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-obra-500">
            {meta}
          </div>
        )}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

export function EstadoVacio({
  titulo,
  mensaje,
  accion,
}: {
  titulo: string
  mensaje: string
  accion?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-obra-300 bg-white px-6 py-14 text-center">
      <p className="font-medium text-obra-900">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-obra-500">{mensaje}</p>
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}
