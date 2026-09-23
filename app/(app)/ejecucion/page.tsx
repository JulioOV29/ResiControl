'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  Clock,
  CornerDownRight,
  Gauge,
  ListChecks,
  Percent,
  Plus,
  Ruler,
  Target,
  X,
} from 'lucide-react'
import { useRecursoUnico, useEliminacion, useRetardo } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Insignia } from '@/components/ui/badge'
import { Seleccion, Entrada } from '@/components/ui/input'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/card'
import { FormRegistroObra } from '@/components/formularios/FormRegistroObra'
import { FormRegistroAvance } from '@/components/formularios/FormRegistroAvance'
import { DetalleRegistro } from '@/components/DetalleRegistro'
import { Indicador } from '@/components/Indicador'
import { indicadoresJornada, formatoDuracion } from '@/lib/calculos'
import {
  conciliar,
  expandirFilas,
  opcionesDisponibles,
  type Dimension,
  type Seleccion as SeleccionFiltros,
} from '@/lib/filtrosRelacionales'
import { codigosDeRegistro, formatoFecha, formatoNumero, formatoPorcentaje } from '@/lib/utils'
import { crearEtiquetas } from '@/lib/etiquetas'
import type { Catalogos, ListaRegistros, Registro } from '@/types/dominio'

const filtrosVacios = {
  proyectoId: '',
  torreId: '',
  actividadId: '',
  cuadrillaId: '',
  desde: '',
  hasta: '',
}

/**
 * Los filtros de esta pantalla son los mismos cuatro que los del panel, asi
 * que se condicionan igual: cada uno solo ofrece lo que tiene registros
 * detras. La seleccion se traduce a las ocho dimensiones que entiende
 * lib/filtrosRelacionales, y de vuelta solo se leen las cuatro de aqui.
 */
const SELECCION_VACIA: SeleccionFiltros = {
  proyectoId: '',
  torreId: '',
  pisoId: '',
  zonaId: '',
  actividadId: '',
  cuadrillaId: '',
  trabajadorId: '',
  cargoId: '',
}

const aSeleccion = (f: typeof filtrosVacios): SeleccionFiltros => ({
  ...SELECCION_VACIA,
  proyectoId: f.proyectoId,
  torreId: f.torreId,
  actividadId: f.actividadId,
  cuadrillaId: f.cuadrillaId,
})

export default function EjecucionPage() {
  const [filtros, setFiltros] = useState(filtrosVacios)
  const puede = usePuede()

  // Los filtros se aplican cuando el usuario deja de moverlos: un campo de
  // fecha dispara onChange varias veces mientras se escribe.
  const filtrosAplicados = useRetardo(filtros)

  const consulta = useMemo(() => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(filtrosAplicados)) if (v) p.set(k, v)
    const texto = p.toString()
    return texto ? `/api/registros?${texto}` : '/api/registros'
  }, [filtrosAplicados])

  const { dato, cargando, recargar, recargarEnSilencio, actualizar } =
    useRecursoUnico<ListaRegistros>(consulta)

  // El resumen viene calculado del servidor, sobre TODO lo que cumple el
  // filtro. Antes se sumaba aqui a partir de las filas recibidas, que es lo
  // mismo solo mientras la lista quepa entera.
  const datos = useMemo(() => dato?.registros ?? [], [dato])
  const resumen = dato?.resumen

  /**
   * Un solo viaje para los desplegables, con las combinaciones reales de los
   * registros: con ellas los filtros se condicionan entre si sin volver al
   * servidor, igual que en el panel.
   */
  const { dato: catalogos } = useRecursoUnico<Catalogos>('/api/catalogos?combinaciones=1')

  const filas = useMemo(
    () => (catalogos?.combinaciones ? expandirFilas(catalogos, catalogos.combinaciones) : []),
    [catalogos],
  )

  const disponibles = useMemo(
    () => opcionesDisponibles(filas, aSeleccion(filtros)),
    [filas, filtros],
  )

  // Las opciones se escriben como en el panel: lo que cuelga de un proyecto
  // lleva su codigo detras de un guion.
  const etiquetas = useMemo(() => crearEtiquetas(catalogos), [catalogos])

  // Lo que no tiene registros desaparece de la lista, en vez de quedar en gris.
  // Mientras los catalogos no hayan llegado no se descarta nada.
  const soloDisponibles = <T extends { id: number }>(dimension: Dimension, lista: T[]) =>
    filas.length === 0 ? lista : lista.filter((x) => disponibles[dimension].has(x.id))

  const proyectos = soloDisponibles('proyectoId', catalogos?.proyectos ?? [])
  const actividades = soloDisponibles('actividadId', catalogos?.actividades ?? [])

  // La torre ya no espera a que se elija proyecto: si solo hay obra en una, es
  // la unica que se ofrece, y elegirla deja el proyecto implicito.
  const torres = useMemo(
    () =>
      soloDisponibles(
        'torreId',
        (catalogos?.torres ?? []).filter(
          (t) => !filtros.proyectoId || t.proyectoId === Number(filtros.proyectoId),
        ),
      ),
    [catalogos, filtros.proyectoId, filas, disponibles],
  )

  const cuadrillas = useMemo(
    () =>
      soloDisponibles(
        'cuadrillaId',
        (catalogos?.cuadrillas ?? []).filter(
          (c) => !filtros.proyectoId || c.proyectoId === Number(filtros.proyectoId),
        ),
      ),
    [catalogos, filtros.proyectoId, filas, disponibles],
  )

  /**
   * Todo cambio de filtro pasa por aqui: lo que se acaba de elegir manda, y lo
   * que ya no cuadra con ello se suelta solo.
   */
  const cambiar = (campos: Partial<typeof filtrosVacios>) =>
    setFiltros((f) => {
      const propuesta = { ...f, ...campos }
      const dimensiones = Object.keys(campos).filter((k) => k in SELECCION_VACIA)
      if (dimensiones.length === 0) return propuesta

      const conciliada = conciliar(filas, aSeleccion(propuesta), dimensiones)
      return {
        ...propuesta,
        proyectoId: conciliada.proyectoId,
        torreId: conciliada.torreId,
        actividadId: conciliada.actividadId,
        cuadrillaId: conciliada.cuadrillaId,
      }
    })

  /**
   * Al guardar, la fila se pone en pantalla de inmediato y el resumen se pone
   * al dia en segundo plano: la tabla no parpadea y las cifras no se quedan
   * viejas.
   */
  const agregarAlInicio = (nuevo: Registro) => {
    actualizar((previo) => ({ ...previo, registros: [nuevo, ...previo.registros] }))
    recargarEnSilencio()
  }

  const eliminacion = useEliminacion('/api/registros', recargar)
  const [formObra, setFormObra] = useState<{ abierto: boolean; registro: Registro | null }>({
    abierto: false,
    registro: null,
  })
  const [formAvance, setFormAvance] = useState<{ abierto: boolean; registro: Registro | null }>({
    abierto: false,
    registro: null,
  })
  const [verRegistro, setVerRegistro] = useState<number | null>(null)

  const hayFiltros = Object.values(filtros).some(Boolean)

  const editar = (r: Registro) =>
    r.registroOrigenId === null
      ? setFormObra({ abierto: true, registro: r })
      : setFormAvance({ abierto: true, registro: r })

  const columnas: Columna<Registro>[] = [
    {
      clave: 'codigo',
      titulo: 'Registro',
      render: (r) => {
        const c = codigosDeRegistro(r)
        return (
          <div>
            <span className="font-medium text-obra-900">{c.obra}</span>
            <div className="text-xs text-obra-400">{formatoFecha(r.fechaEjecucion)}</div>
          </div>
        )
      },
    },
    {
      clave: 'subregistro',
      titulo: 'Subregistro',
      render: (r) => {
        const c = codigosDeRegistro(r)
        return c.esApertura ? (
          <Insignia tono="info">Obra</Insignia>
        ) : (
          <Insignia tono="aviso">{c.subregistro}</Insignia>
        )
      },
    },
    {
      clave: 'ubicacion',
      titulo: 'Ubicacion',
      render: (r) => {
        const z = r.frente?.zona
        if (!z) return '-'
        return (
          <div className="text-sm">
            <div className="text-obra-900">{z.nombre}</div>
            <div className="text-xs text-obra-400">
              {z.piso.torre.nombre} · {z.piso.nombre || `Piso ${z.piso.numero}`}
            </div>
          </div>
        )
      },
    },
    {
      clave: 'frente',
      titulo: 'Frente',
      soloEscritorio: true,
      render: (r) => (
        <div className="text-sm">
          <div className="text-obra-900">{r.frente?.descripcion}</div>
          <div className="text-xs text-obra-400">{r.frente?.codigoDwg}</div>
        </div>
      ),
    },
    { clave: 'actividad', titulo: 'Actividad', render: (r) => r.actividad?.nombre ?? '-' },
    {
      clave: 'personal',
      titulo: 'Personal',
      soloEscritorio: true,
      render: (r) => (
        <div className="text-sm">
          <div className="text-obra-900">
            {r.trabajador ? `${r.trabajador.apellido} ${r.trabajador.nombre}` : 'Sin asignar'}
          </div>
          <div className="text-xs text-obra-400">{r.cuadrilla?.nombre}</div>
        </div>
      ),
    },
    {
      clave: 'ejecutado',
      titulo: 'm2 ejec.',
      alineacion: 'derecha',
      render: (r) => formatoNumero(r.m2Ejecutados),
    },
    {
      clave: 'rendimiento',
      titulo: 'Rendimiento',
      alineacion: 'derecha',
      render: (r) => {
        const i = indicadoresJornada(r)
        return i.rendimiento === null ? '-' : `${formatoNumero(i.rendimiento)} m2/h`
      },
    },
    {
      clave: 'cumplimiento',
      titulo: 'Cumplimiento',
      alineacion: 'derecha',
      render: (r) => {
        const i = indicadoresJornada(r)
        return (
          <span
            className={
              i.cumplimiento !== null && i.cumplimiento >= 1
                ? 'font-medium text-emerald-600'
                : undefined
            }
          >
            {formatoPorcentaje(i.cumplimiento)}
          </span>
        )
      },
    },
    {
      clave: 'viene',
      titulo: 'Viene de',
      render: (r) =>
        r.registroAnterior ? (
          <button
            onClick={() => setVerRegistro(r.registroAnterior!.id)}
            title={`Ver el registro ${r.registroAnterior.codigoRegistro}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-obra-200 px-2 py-1 text-xs font-medium text-obra-700 hover:border-acento-400 hover:bg-acento-50"
          >
            <CornerDownRight className="h-3.5 w-3.5 text-obra-400" />
            {r.registroAnterior.codigoRegistro}
          </button>
        ) : (
          <span className="text-xs text-obra-400">inicio de obra</span>
        ),
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Registros de obra"
        descripcion="Cada obra empieza con un registro y sigue con avances encadenados hasta el 100%."
        acciones={
          puede.registrar && (
            <>
              <Boton
                variante="contorno"
                onClick={() => setFormAvance({ abierto: true, registro: null })}
              >
                <CornerDownRight className="h-4 w-4" />
                Nuevo registro de avance
              </Boton>
              <Boton onClick={() => setFormObra({ abierto: true, registro: null })}>
                <Plus className="h-4 w-4" />
                Nuevo registro de obra
              </Boton>
            </>
          )
        }
      />

      <Tarjeta className="mb-4">
        <TarjetaCuerpo className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Seleccion
            value={filtros.proyectoId}
            onChange={(e) => cambiar({ proyectoId: e.target.value })}
          >
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo}
              </option>
            ))}
          </Seleccion>

          <Seleccion
            value={filtros.torreId}
            onChange={(e) => cambiar({ torreId: e.target.value })}
          >
            <option value="">Todas las torres</option>
            {torres.map((t) => (
              <option key={t.id} value={t.id}>
                {etiquetas.torre(t)}
              </option>
            ))}
          </Seleccion>

          <Seleccion
            value={filtros.actividadId}
            onChange={(e) => cambiar({ actividadId: e.target.value })}
          >
            <option value="">Todas las actividades</option>
            {actividades.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </Seleccion>

          <Seleccion
            value={filtros.cuadrillaId}
            onChange={(e) => cambiar({ cuadrillaId: e.target.value })}
          >
            <option value="">Todas las cuadrillas</option>
            {cuadrillas.map((c) => (
              <option key={c.id} value={c.id}>
                {etiquetas.cuadrilla(c)}
              </option>
            ))}
          </Seleccion>

          <Entrada
            type="date"
            value={filtros.desde}
            onChange={(e) => cambiar({ desde: e.target.value })}
            title="Desde"
          />
          <div className="flex gap-2">
            <Entrada
              type="date"
              value={filtros.hasta}
              onChange={(e) => cambiar({ hasta: e.target.value })}
              title="Hasta"
            />
            {hayFiltros && (
              <button
                onClick={() => setFiltros(filtrosVacios)}
                className="shrink-0 rounded-lg border border-obra-200 px-2 text-obra-500 hover:bg-obra-50"
                title="Limpiar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      {resumen && resumen.registros > 0 && (
        <>
          {/* Las mismas tarjetas del panel: un solo componente, un solo aspecto. */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
            <Indicador
              etiqueta="Produccion"
              valor={formatoNumero(resumen.m2Ejecutados)}
              unidad="m2"
              icono={Ruler}
              acento
            />
            <Indicador
              etiqueta="Pendiente"
              valor={formatoNumero(resumen.m2Pendientes)}
              unidad="m2"
              icono={Target}
            />
            <Indicador
              etiqueta="Avance"
              valor={formatoPorcentaje(resumen.avance)}
              detalle={`acumulado sobre ${formatoNumero(resumen.m2Totales)} m2`}
              icono={Percent}
            />
            <Indicador
              etiqueta="Cumplimiento"
              valor={formatoPorcentaje(resumen.cumplimiento)}
              detalle={`meta ${formatoNumero(resumen.m2Meta)} m2`}
              icono={Activity}
            />
            <Indicador
              etiqueta="Rendimiento"
              valor={resumen.rendimiento === null ? '-' : formatoNumero(resumen.rendimiento)}
              unidad="m2/h"
              icono={Gauge}
            />
            <Indicador
              etiqueta="Horas efectivas"
              valor={formatoNumero(resumen.horasEfectivas, 1)}
              unidad="h"
              detalle={`receso ${formatoDuracion(resumen.minutosReceso)}`}
              icono={Clock}
            />
            <Indicador
              etiqueta="Registros"
              valor={formatoNumero(resumen.registros, 0)}
              detalle={`en ${formatoNumero(resumen.obras, 0)} obras`}
              icono={ListChecks}
            />
          </div>

          {dato?.truncado && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              La tabla muestra los {formatoNumero(datos.length, 0)} registros mas recientes de los{' '}
              {formatoNumero(resumen.registros, 0)} que cumplen el filtro. Los indicadores de
              arriba si estan calculados sobre todos. Afina las fechas para ver el resto.
            </p>
          )}

          <p className="mb-4 text-xs text-obra-500">
            Los indicadores salen de sumar numeradores y denominadores, y el area de cada obra
            cuenta una sola vez aunque el trabajo se haya repartido en varios registros.
          </p>
        </>
      )}

      <Tabla
        columnas={columnas}
        filas={datos}
        cargando={cargando}
        onFilaClick={(r) => setVerRegistro(r.id)}
        acciones={
          puede.registrar
            ? (r) => (
                <AccionesEditarBorrar
                  onEditar={() => editar(r)}
                  onEliminar={() => eliminacion.pedir(r.id, r.codigoRegistro)}
                />
              )
            : undefined
        }
        vacio={
          <EstadoVacio
            titulo={hayFiltros ? 'Ningun registro coincide' : 'Sin registros de obra'}
            mensaje={
              hayFiltros
                ? 'Prueba ampliando el rango de fechas o quitando algun filtro.'
                : 'Empieza con un registro de obra: el primer dia de trabajo sobre un elemento, con sus medidas. Los dias siguientes se cargan como registros de avance.'
            }
            accion={
              hayFiltros ? (
                <Boton variante="contorno" onClick={() => setFiltros(filtrosVacios)}>
                  Limpiar filtros
                </Boton>
              ) : (
                puede.registrar && (
                  <Boton onClick={() => setFormObra({ abierto: true, registro: null })}>
                    Crear el primero
                  </Boton>
                )
              )
            }
          />
        }
      />

      <FormRegistroObra
        abierto={formObra.abierto}
        registro={formObra.registro}
        onCerrar={() => setFormObra({ abierto: false, registro: null })}
        onGuardado={(creado) => {
          const eraNuevo = formObra.registro === null
          setFormObra({ abierto: false, registro: null })
          // La fila aparece al instante y la recarga deja la lista ordenada.
          if (eraNuevo) agregarAlInicio(creado)
          recargar()
        }}
      />

      <FormRegistroAvance
        abierto={formAvance.abierto}
        registro={formAvance.registro}
        onCerrar={() => setFormAvance({ abierto: false, registro: null })}
        onGuardado={(creado) => {
          const eraNuevo = formAvance.registro === null
          setFormAvance({ abierto: false, registro: null })
          if (eraNuevo) agregarAlInicio(creado)
          recargar()
        }}
      />

      <DetalleRegistro
        registroId={verRegistro}
        onCerrar={() => setVerRegistro(null)}
        onIr={setVerRegistro}
      />

      <ConfirmarEliminacion
        abierto={Boolean(eliminacion.objetivo)}
        titulo="Eliminar registro"
        mensaje={`Se eliminara el registro ${eliminacion.objetivo?.etiqueta}. Solo se puede borrar por el final de la cadena: si tiene un avance posterior, hay que eliminar ese primero.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
