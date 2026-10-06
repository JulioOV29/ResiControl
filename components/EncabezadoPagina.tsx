/** Encabezado de pagina: antetitulo pequeno, titulo, descripcion y acciones. */
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
  /** Linea de datos bajo el titulo: fechas, estado, conteos. */
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
      {/* En celular los botones van uno debajo del otro, a todo el ancho. */}
      {acciones && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap [&>*]:w-full sm:[&>*]:w-auto">
          {acciones}
        </div>
      )}
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-obra-200 bg-white px-6 py-14 text-center">
      <p className="font-medium text-obra-900">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-obra-500">{mensaje}</p>
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}
