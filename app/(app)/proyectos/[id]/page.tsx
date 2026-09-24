'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { useRecurso, useRecursoUnico, useEliminacion } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Insignia, tonoEstado, textoEstado } from '@/components/ui/badge'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { FormTorre } from '@/components/formularios/FormTorre'
import { FormPiso } from '@/components/formularios/FormPiso'
import { FormZona } from '@/components/formularios/FormZona'
import { FormElemento } from '@/components/formularios/FormElemento'
import { formatoNumero } from '@/lib/utils'
import type { Elemento, Piso, Proyecto, Torre, Zona } from '@/types/dominio'

/**
 * Detalle del proyecto con navegacion por niveles:
 * Torres -> Pisos -> Zonas -> Elementos constructivos.
 * Un solo componente evita cuatro rutas anidadas y mantiene la ruta migada
 * siempre visible, que es como el residente piensa la obra.
 */
export default function ProyectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const puede = usePuede()

  const [torre, setTorre] = useState<Torre | null>(null)
  const [piso, setPiso] = useState<Piso | null>(null)
  const [zona, setZona] = useState<Zona | null>(null)

  const { dato: proyecto, cargando: cargandoProyecto } = useRecursoUnico<Proyecto>(
    `/api/proyectos/${id}`,
  )
  const torres = useRecurso<Torre>(`/api/torres?proyectoId=${id}`)
  const pisos = useRecurso<Piso>(torre ? `/api/pisos?torreId=${torre.id}` : null)
  const zonas = useRecurso<Zona>(piso ? `/api/zonas?pisoId=${piso.id}` : null)
  const elementos = useRecurso<Elemento>(zona ? `/api/elementos?zonaId=${zona.id}` : null)

  const [formTorre, setFormTorre] = useState<{ abierto: boolean; registro: Torre | null }>({
    abierto: false,
    registro: null,
  })
  const [formPiso, setFormPiso] = useState<{ abierto: boolean; registro: Piso | null }>({
    abierto: false,
    registro: null,
  })
  const [formZona, setFormZona] = useState<{ abierto: boolean; registro: Zona | null }>({
    abierto: false,
    registro: null,
  })
  const [formElemento, setFormElemento] = useState<{ abierto: boolean; registro: Elemento | null }>({
    abierto: false,
    registro: null,
  })

  const borrarTorre = useEliminacion('/api/torres', torres.recargar)
  const borrarPiso = useEliminacion('/api/pisos', pisos.recargar)
  const borrarZona = useEliminacion('/api/zonas', zonas.recargar)
  const borrarElemento = useEliminacion('/api/elementos', elementos.recargar)

  const irATorres = () => {
    setTorre(null)
    setPiso(null)
    setZona(null)
  }
  const irAPisos = () => {
    setPiso(null)
    setZona(null)
  }
  const irAZonas = () => setZona(null)

  if (cargandoProyecto) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-obra-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    )
  }

  if (!proyecto) {
    return (
      <EstadoVacio
        titulo="No se encontro el proyecto"
        mensaje="Puede que haya sido eliminado."
        accion={
          <Link href="/proyectos">
            <Boton variante="contorno">Volver a proyectos</Boton>
          </Link>
        }
      />
    )
  }

  const migas = [
    { texto: proyecto.nombre, alClic: irATorres },
    ...(torre ? [{ texto: torre.nombre, alClic: irAPisos }] : []),
    ...(piso ? [{ texto: piso.nombre || `Piso ${piso.numero}`, alClic: irAZonas }] : []),
    ...(zona ? [{ texto: zona.nombre, alClic: () => {} }] : []),
  ]

  const columnasTorres: Columna<Torre>[] = [
    {
      clave: 'nombre',
      titulo: 'Torre',
      render: (t) => (
        <div>
          <span className="font-medium text-obra-900">{t.nombre}</span>
          <span className="ml-2 text-xs text-obra-400">{t.codigo}</span>
        </div>
      ),
    },
    { clave: 'pisos', titulo: 'Pisos', alineacion: 'derecha', render: (t) => t._count?.pisos ?? 0 },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (t) => <Insignia tono={tonoEstado(t.estado)}>{textoEstado(t.estado)}</Insignia>,
    },
  ]

  const columnasPisos: Columna<Piso>[] = [
    {
      clave: 'numero',
      titulo: 'Piso',
      render: (p) => <span className="font-medium text-obra-900">{p.nombre || `Piso ${p.numero}`}</span>,
    },
    { clave: 'num', titulo: 'Numero', alineacion: 'derecha', soloEscritorio: true, render: (p) => p.numero },
    { clave: 'zonas', titulo: 'Zonas', alineacion: 'derecha', render: (p) => p._count?.zonas ?? 0 },
  ]

  const columnasZonas: Columna<Zona>[] = [
    {
      clave: 'nombre',
      titulo: 'Zona',
      render: (z) => (
        <div>
          <span className="font-medium text-obra-900">{z.nombre}</span>
          <span className="ml-2 text-xs text-obra-400">{z.codigo}</span>
        </div>
      ),
    },
    { clave: 'tipo', titulo: 'Tipo', render: (z) => z.tipo || <span className="text-obra-400">-</span> },
    {
      clave: 'elementos',
      titulo: 'Elementos',
      alineacion: 'derecha',
      render: (z) => z._count?.elementos ?? 0,
    },
  ]

  const columnasElementos: Columna<Elemento>[] = [
    { clave: 'codigo', titulo: 'Codigo DWG', render: (f) => f.codigoDwg },
    {
      clave: 'descripcion',
      titulo: 'Elemento',
      render: (f) => <span className="font-medium text-obra-900">{f.descripcion}</span>,
    },
    {
      // Las medidas son la cantidad por ejecutar del elemento: se ven aqui
      // porque es donde se definen, y de aqui las heredan tarea y registro.
      clave: 'medidas',
      titulo: 'Medidas',
      alineacion: 'derecha',
      render: (f) => (
        <span>
          <span className="block tabular-nums text-obra-900">
            {formatoNumero(f.largo * f.alto)} {f.unidad || 'm2'}
          </span>
          <span className="block text-xs tabular-nums text-obra-500">
            {formatoNumero(f.largo)} x {formatoNumero(f.alto)} m
          </span>
        </span>
      ),
    },
    {
      clave: 'registros',
      titulo: 'Registros',
      alineacion: 'derecha',
      render: (f) => f._count?.registros ?? 0,
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (f) => <Insignia tono={tonoEstado(f.estado)}>{textoEstado(f.estado)}</Insignia>,
    },
  ]

  return (
    <div>
      <Link
        href="/proyectos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-obra-500 hover:text-obra-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Proyectos
      </Link>

      <nav className="mb-5 flex flex-wrap items-center gap-1 text-sm">
        {migas.map((miga, indice) => (
          <span key={indice} className="flex items-center gap-1">
            {indice > 0 && <ChevronRight className="h-4 w-4 text-obra-300" />}
            {indice === migas.length - 1 ? (
              <span className="font-medium text-obra-900">{miga.texto}</span>
            ) : (
              <button onClick={miga.alClic} className="text-obra-500 hover:text-obra-900">
                {miga.texto}
              </button>
            )}
          </span>
        ))}
      </nav>

      {/* Nivel 1: torres */}
      {!torre && (
        <>
          <EncabezadoPagina
            titulo="Torres"
            descripcion={`${proyecto.codigo} | ${textoEstado(proyecto.estado)}`}
            acciones={
              puede.gestionar && (
                <Boton onClick={() => setFormTorre({ abierto: true, registro: null })}>
                  <Plus className="h-4 w-4" />
                  Nueva torre
                </Boton>
              )
            }
          />
          <Tabla
            columnas={columnasTorres}
            filas={torres.datos}
            cargando={torres.cargando}
            onFilaClick={setTorre}
            acciones={
              puede.gestionar
                ? (t) => (
                    <AccionesEditarBorrar
                      onEditar={() => setFormTorre({ abierto: true, registro: t })}
                      onEliminar={() => borrarTorre.pedir(t.id, t.nombre)}
                    />
                  )
                : undefined
            }
            vacio={
              <EstadoVacio
                titulo="Sin torres"
                mensaje="La torre es el primer nivel de la obra. De ella cuelgan los pisos, las zonas y los elementos."
                accion={
                  puede.gestionar && (
                    <Boton onClick={() => setFormTorre({ abierto: true, registro: null })}>
                      Crear la primera
                    </Boton>
                  )
                }
              />
            }
          />
        </>
      )}

      {/* Nivel 2: pisos */}
      {torre && !piso && (
        <>
          <EncabezadoPagina
            titulo="Pisos"
            descripcion={`Pisos de ${torre.nombre}`}
            acciones={
              puede.gestionar && (
                <Boton onClick={() => setFormPiso({ abierto: true, registro: null })}>
                  <Plus className="h-4 w-4" />
                  Nuevo piso
                </Boton>
              )
            }
          />
          <Tabla
            columnas={columnasPisos}
            filas={pisos.datos}
            cargando={pisos.cargando}
            onFilaClick={setPiso}
            acciones={
              puede.gestionar
                ? (p) => (
                    <AccionesEditarBorrar
                      onEditar={() => setFormPiso({ abierto: true, registro: p })}
                      onEliminar={() => borrarPiso.pedir(p.id, p.nombre || `Piso ${p.numero}`)}
                    />
                  )
                : undefined
            }
            vacio={
              <EstadoVacio
                titulo="Sin pisos"
                mensaje="Agrega los pisos de esta torre. Puedes usar numeros negativos para sotanos."
                accion={
                  puede.gestionar && (
                    <Boton onClick={() => setFormPiso({ abierto: true, registro: null })}>
                      Crear el primero
                    </Boton>
                  )
                }
              />
            }
          />
        </>
      )}

      {/* Nivel 3: zonas */}
      {piso && !zona && (
        <>
          <EncabezadoPagina
            titulo="Zonas"
            descripcion={`Apartamentos y areas del ${piso.nombre || `piso ${piso.numero}`}`}
            acciones={
              puede.gestionar && (
                <Boton onClick={() => setFormZona({ abierto: true, registro: null })}>
                  <Plus className="h-4 w-4" />
                  Nueva zona
                </Boton>
              )
            }
          />
          <Tabla
            columnas={columnasZonas}
            filas={zonas.datos}
            cargando={zonas.cargando}
            onFilaClick={setZona}
            acciones={
              puede.gestionar
                ? (z) => (
                    <AccionesEditarBorrar
                      onEditar={() => setFormZona({ abierto: true, registro: z })}
                      onEliminar={() => borrarZona.pedir(z.id, z.nombre)}
                    />
                  )
                : undefined
            }
            vacio={
              <EstadoVacio
                titulo="Sin zonas"
                mensaje="Una zona es un apartamento o un area comun dentro del piso."
                accion={
                  puede.gestionar && (
                    <Boton onClick={() => setFormZona({ abierto: true, registro: null })}>
                      Crear la primera
                    </Boton>
                  )
                }
              />
            }
          />
        </>
      )}

      {/* Nivel 4: elementos constructivos */}
      {zona && (
        <>
          <EncabezadoPagina
            titulo="Elementos constructivos"
            descripcion={`Elementos fisicos de ${zona.nombre}`}
            acciones={
              puede.gestionar && (
                <Boton onClick={() => setFormElemento({ abierto: true, registro: null })}>
                  <Plus className="h-4 w-4" />
                  Nuevo elemento
                </Boton>
              )
            }
          />
          <Tabla
            columnas={columnasElementos}
            filas={elementos.datos}
            cargando={elementos.cargando}
            acciones={
              puede.gestionar
                ? (f) => (
                    <AccionesEditarBorrar
                      onEditar={() => setFormElemento({ abierto: true, registro: f })}
                      onEliminar={() => borrarElemento.pedir(f.id, `${f.codigoDwg} ${f.descripcion}`)}
                    />
                  )
                : undefined
            }
            vacio={
              <EstadoVacio
                titulo="Sin elementos constructivos"
                mensaje="El elemento constructivo es la pieza concreta sobre la que se ejecuta la actividad: un muro, una losa, una fachada. Aqui se miden sus dimensiones una sola vez, y de aqui las heredan las tareas y los registros de obra."
                accion={
                  puede.gestionar && (
                    <Boton onClick={() => setFormElemento({ abierto: true, registro: null })}>
                      Crear el primero
                    </Boton>
                  )
                }
              />
            }
          />
        </>
      )}

      <FormTorre
        abierto={formTorre.abierto}
        registro={formTorre.registro}
        proyectoId={Number(id)}
        onCerrar={() => setFormTorre({ abierto: false, registro: null })}
        onGuardado={() => {
          setFormTorre({ abierto: false, registro: null })
          torres.recargar()
        }}
      />

      {torre && (
        <FormPiso
          abierto={formPiso.abierto}
          registro={formPiso.registro}
          torreId={torre.id}
          onCerrar={() => setFormPiso({ abierto: false, registro: null })}
          onGuardado={() => {
            setFormPiso({ abierto: false, registro: null })
            pisos.recargar()
          }}
        />
      )}

      {piso && (
        <FormZona
          abierto={formZona.abierto}
          registro={formZona.registro}
          pisoId={piso.id}
          onCerrar={() => setFormZona({ abierto: false, registro: null })}
          onGuardado={() => {
            setFormZona({ abierto: false, registro: null })
            zonas.recargar()
          }}
        />
      )}

      {zona && (
        <FormElemento
          abierto={formElemento.abierto}
          registro={formElemento.registro}
          zonaId={zona.id}
          onCerrar={() => setFormElemento({ abierto: false, registro: null })}
          onGuardado={() => {
            setFormElemento({ abierto: false, registro: null })
            elementos.recargar()
          }}
        />
      )}

      <ConfirmarEliminacion
        abierto={Boolean(borrarTorre.objetivo)}
        titulo="Eliminar torre"
        mensaje={`Se eliminara "${borrarTorre.objetivo?.etiqueta}" con sus pisos, zonas y elementos.`}
        procesando={borrarTorre.procesando}
        error={borrarTorre.error}
        onCancelar={borrarTorre.cancelar}
        onConfirmar={borrarTorre.confirmar}
      />
      <ConfirmarEliminacion
        abierto={Boolean(borrarPiso.objetivo)}
        titulo="Eliminar piso"
        mensaje={`Se eliminara "${borrarPiso.objetivo?.etiqueta}" con sus zonas y elementos.`}
        procesando={borrarPiso.procesando}
        error={borrarPiso.error}
        onCancelar={borrarPiso.cancelar}
        onConfirmar={borrarPiso.confirmar}
      />
      <ConfirmarEliminacion
        abierto={Boolean(borrarZona.objetivo)}
        titulo="Eliminar zona"
        mensaje={`Se eliminara "${borrarZona.objetivo?.etiqueta}" con sus elementos constructivos.`}
        procesando={borrarZona.procesando}
        error={borrarZona.error}
        onCancelar={borrarZona.cancelar}
        onConfirmar={borrarZona.confirmar}
      />
      <ConfirmarEliminacion
        abierto={Boolean(borrarElemento.objetivo)}
        titulo="Eliminar elemento constructivo"
        mensaje={`Se eliminara "${borrarElemento.objetivo?.etiqueta}". No se puede si ya tiene registros de obra.`}
        procesando={borrarElemento.procesando}
        error={borrarElemento.error}
        onCancelar={borrarElemento.cancelar}
        onConfirmar={borrarElemento.confirmar}
      />
    </div>
  )
}
