'use client'

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Insignia } from '@/components/ui/badge'
import { useRecursoUnico } from '@/lib/cliente'
import { codigosDeRegistro, formatoFecha, formatoNumero, formatoPorcentaje } from '@/lib/utils'
import { dateAHora, formatoDuracion, indicadoresJornada } from '@/lib/calculos'
import type { Registro } from '@/types/dominio'

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-obra-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-obra-900">{valor}</dd>
    </div>
  )
}

/**
 * Ficha de un registro. Se abre al pulsar la referencia al registro anterior,
 * y desde ella se puede seguir retrocediendo por la cadena de la obra.
 */
export function DetalleRegistro({
  registroId,
  onCerrar,
  onIr,
}: {
  registroId: number | null
  onCerrar: () => void
  onIr: (id: number) => void
}) {
  const { dato, cargando } = useRecursoUnico<Registro>(
    registroId ? `/api/registros/${registroId}` : null,
  )

  const i = dato ? indicadoresJornada(dato) : null
  const codigos = dato ? codigosDeRegistro(dato) : null
  const esApertura = codigos?.esApertura ?? false

  return (
    <Modal
      titulo={
        codigos
          ? codigos.esApertura
            ? `Registro ${codigos.obra}`
            : `${codigos.obra} · ${codigos.subregistro}`
          : 'Registro'
      }
      descripcion={dato ? formatoFecha(dato.fechaEjecucion) : undefined}
      abierto={registroId !== null}
      onCerrar={onCerrar}
      ancho="lg"
    >
      {cargando || !dato || !i ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-obra-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono={esApertura ? 'info' : 'aviso'}>
              {esApertura
                ? 'Registro de obra'
                : `Subregistro ${codigos?.subregistro} de la obra ${codigos?.obra}`}
            </Insignia>
            {dato.actividad && <Insignia tono="aviso">{dato.actividad.nombre}</Insignia>}
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dato
              etiqueta="Ubicacion"
              valor={
                dato.elemento ? (
                  <>
                    {dato.elemento.zona.piso.torre.nombre} ·{' '}
                    {dato.elemento.zona.piso.nombre || `Piso ${dato.elemento.zona.piso.numero}`} ·{' '}
                    {dato.elemento.zona.nombre}
                  </>
                ) : (
                  '-'
                )
              }
            />
            <Dato
              etiqueta="Elemento"
              valor={dato.elemento ? `${dato.elemento.codigoDwg} · ${dato.elemento.descripcion}` : '-'}
            />
            <Dato etiqueta="Cuadrilla" valor={dato.cuadrilla?.nombre ?? '-'} />
            <Dato
              etiqueta="Trabajador"
              valor={
                dato.trabajador
                  ? `${dato.trabajador.apellido} ${dato.trabajador.nombre} (${dato.trabajador.cargo.nombre})`
                  : 'Sin asignar'
              }
            />
            <Dato
              etiqueta="Horario"
              valor={`${dateAHora(dato.horaInicio)} a ${dateAHora(dato.horaFinal)}, receso ${dato.tiempoRecesoMin} min`}
            />
            <Dato etiqueta="Tiempo efectivo" valor={formatoDuracion(i.minutosEfectivos)} />
            <Dato etiqueta="m2 ejecutados" valor={`${formatoNumero(dato.m2Ejecutados)} m2`} />
            <Dato
              etiqueta="m2 meta del dia"
              valor={dato.m2Meta === null ? '-' : `${formatoNumero(dato.m2Meta)} m2`}
            />
            <Dato
              etiqueta="Rendimiento"
              valor={i.rendimiento === null ? '-' : `${formatoNumero(i.rendimiento)} m2/h`}
            />
            <Dato etiqueta="Cumplimiento" valor={formatoPorcentaje(i.cumplimiento)} />
            {esApertura && (
              <Dato
                etiqueta="Medidas del elemento"
                valor={`${formatoNumero(dato.largo)} x ${formatoNumero(dato.alto)} = ${formatoNumero(
                  (dato.largo ?? 0) * (dato.alto ?? 0),
                )} m2`}
              />
            )}
            <Dato
              etiqueta="Registrado por"
              valor={
                dato.usuarioRegistra
                  ? `${dato.usuarioRegistra.nombre} ${dato.usuarioRegistra.apellido}`
                  : '-'
              }
            />
          </dl>

          {dato.observaciones && (
            <div className="rounded-lg border border-obra-200 bg-obra-50 px-3 py-2">
              <p className="text-xs text-obra-500">Observaciones</p>
              <p className="mt-1 text-sm text-obra-700">{dato.observaciones}</p>
            </div>
          )}

          {/* Navegacion por la cadena de la obra */}
          {(dato.registroAnterior || dato.continuacion) && (
            <div className="flex flex-wrap gap-2 border-t border-obra-100 pt-4">
              {dato.registroAnterior && (
                <button
                  onClick={() => onIr(dato.registroAnterior!.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-obra-200 px-3 py-2 text-sm text-obra-700 hover:bg-obra-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Anterior: {dato.registroAnterior.codigoRegistro} del{' '}
                  {formatoFecha(dato.registroAnterior.fechaEjecucion)}
                </button>
              )}
              {dato.continuacion && (
                <button
                  onClick={() => onIr(dato.continuacion!.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-obra-200 px-3 py-2 text-sm text-obra-700 hover:bg-obra-50"
                >
                  Siguiente: {dato.continuacion.codigoRegistro} del{' '}
                  {formatoFecha(dato.continuacion.fechaEjecucion)}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
