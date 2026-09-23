'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useRecurso, useRecursoUnico, useEliminacion } from '@/lib/cliente'
import { usePuede } from '@/lib/permisos'
import { EncabezadoPagina, EstadoVacio } from '@/components/EncabezadoPagina'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { Boton } from '@/components/ui/button'
import { Insignia } from '@/components/ui/badge'
import { Seleccion } from '@/components/ui/input'
import { AccionesEditarBorrar } from '@/components/ui/acciones'
import { ConfirmarEliminacion } from '@/components/ui/modal'
import { FormTarea } from '@/components/formularios/FormTarea'
import { crearEtiquetas } from '@/lib/etiquetas'
import { ETIQUETA_ESTADO_EJECUCION, ESTADOS_EJECUCION } from '@/lib/dominio'
import { formatoFecha, formatoNumero, formatoPorcentaje } from '@/lib/utils'
import type { Catalogos, EstadoEjecucion, Tarea } from '@/types/dominio'

/** Como va la tarea: lo ejecutado de su obra sobre el area que encarga. */
function avanceDe(t: Tarea) {
  const total = t.largo * t.alto
  const ejecutado = t.registro
    ? t.registro.m2Ejecutados + t.registro.avances.reduce((s, a) => s + a.m2Ejecutados, 0)
    : 0
  return {
    total,
    ejecutado,
    pendiente: Math.max(0, total - ejecutado),
    fraccion: total > 0 ? ejecutado / total : 0,
  }
}

const TONO_ESTADO: Record<EstadoEjecucion, 'neutro' | 'info' | 'exito' | 'aviso'> = {
  PENDIENTE: 'neutro',
  EN_PROCESO: 'info',
  TERMINADO: 'exito',
  SUSPENDIDO: 'aviso',
}

export default function TareasPage() {
  const [proyectoId, setProyectoId] = useState('')
  const [estado, setEstado] = useState('')
  const puede = usePuede()

  const consulta = useMemo(() => {
    const p = new URLSearchParams()
    if (proyectoId) p.set('proyectoId', proyectoId)
    if (estado) p.set('estado', estado)
    const texto = p.toString()
    return texto ? `/api/tareas?${texto}` : '/api/tareas'
  }, [proyectoId, estado])

  const { datos, cargando, recargar } = useRecurso<Tarea>(consulta)
  const { dato: catalogos } = useRecursoUnico<Catalogos>('/api/catalogos')
  const etiquetas = useMemo(() => crearEtiquetas(catalogos), [catalogos])
  const eliminacion = useEliminacion('/api/tareas', recargar)

  const [form, setForm] = useState<{ abierto: boolean; registro: Tarea | null }>({
    abierto: false,
    registro: null,
  })
  const abrirNueva = () => setForm({ abierto: true, registro: null })

  const columnas: Columna<Tarea>[] = [
    { clave: 'codigo', titulo: 'Tarea', render: (t) => t.codigo },
    {
      clave: 'ubicacion',
      titulo: 'Ubicacion',
      render: (t) => {
        const zona = t.frente?.zona
        if (!zona) return '-'
        return (
          <span>
            <span className="block text-obra-900">
              {t.frente?.codigoDwg} · {zona.nombre}
            </span>
            <span className="block text-xs text-obra-500">
              {zona.piso.torre.nombre} · {zona.piso.nombre || `Piso ${zona.piso.numero}`} -{' '}
              {zona.piso.torre.proyecto.codigo}
            </span>
          </span>
        )
      },
    },
    { clave: 'actividad', titulo: 'Actividad', render: (t) => t.actividad?.nombre ?? '-' },
    {
      clave: 'asignada',
      titulo: 'Asignada a',
      soloEscritorio: true,
      render: (t) =>
        t.cuadrilla ? (
          <span>
            <span className="block text-obra-900">{etiquetas.cuadrilla(t.cuadrilla)}</span>
            {t.trabajador && (
              <span className="block text-xs text-obra-500">
                {t.trabajador.apellido} {t.trabajador.nombre}
              </span>
            )}
          </span>
        ) : (
          <span className="text-obra-400">Sin asignar</span>
        ),
    },
    {
      clave: 'plazo',
      titulo: 'Plazo',
      soloEscritorio: true,
      render: (t) =>
        t.fechaInicioPlan || t.fechaFinPlan ? (
          <span className="text-obra-700">
            {t.fechaInicioPlan ? formatoFecha(t.fechaInicioPlan) : 'sin inicio'}
            {t.fechaFinPlan ? ` a ${formatoFecha(t.fechaFinPlan)}` : ''}
          </span>
        ) : (
          <span className="text-obra-400">Sin plazo</span>
        ),
    },
    {
      clave: 'avance',
      titulo: 'Avance',
      alineacion: 'derecha',
      render: (t) => {
        const a = avanceDe(t)
        return (
          <span>
            <span className="block tabular-nums text-obra-900">
              {formatoPorcentaje(a.fraccion)}
            </span>
            <span className="block text-xs tabular-nums text-obra-500">
              {formatoNumero(a.ejecutado)} de {formatoNumero(a.total)} m2
            </span>
          </span>
        )
      },
    },
    {
      clave: 'obra',
      titulo: 'Obra',
      render: (t) =>
        t.registro ? (
          <span className="tabular-nums text-obra-700">{t.registro.codigoRegistro}</span>
        ) : (
          <span className="text-obra-400">Sin empezar</span>
        ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (t) => (
        <Insignia tono={TONO_ESTADO[t.estado]}>{ETIQUETA_ESTADO_EJECUCION[t.estado]}</Insignia>
      ),
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        antetitulo="Programacion"
        titulo="Asignar tareas"
        descripcion="El trabajo que se encarga antes de ejecutarlo. Al registrar la obra, el registro hereda estos datos."
        acciones={
          puede.gestionar && (
            <Boton onClick={abrirNueva}>
              <Plus className="h-4 w-4" />
              Asignar tarea
            </Boton>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Seleccion value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {(catalogos?.proyectos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} - {p.nombre}
            </option>
          ))}
        </Seleccion>
        <Seleccion value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_EJECUCION.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_EJECUCION[e]}
            </option>
          ))}
        </Seleccion>
      </div>

      <Tabla
        columnas={columnas}
        filas={datos}
        cargando={cargando}
        acciones={
          puede.gestionar
            ? (t) => (
                <AccionesEditarBorrar
                  onEditar={() => setForm({ abierto: true, registro: t })}
                  onEliminar={() => eliminacion.pedir(t.id, `la tarea ${t.codigo}`)}
                />
              )
            : undefined
        }
        vacio={
          <EstadoVacio
            titulo="Sin tareas asignadas"
            mensaje="Asigna el trabajo con su ubicacion, sus medidas y a quien le toca. Al registrar la obra, el registro hereda todo eso."
            accion={puede.gestionar && <Boton onClick={abrirNueva}>Asignar la primera</Boton>}
          />
        }
      />

      <FormTarea
        abierto={form.abierto}
        registro={form.registro}
        onCerrar={() => setForm({ abierto: false, registro: null })}
        onGuardado={() => {
          setForm({ abierto: false, registro: null })
          recargar()
        }}
      />

      <ConfirmarEliminacion
        abierto={Boolean(eliminacion.objetivo)}
        titulo="Eliminar tarea"
        mensaje={`Se eliminara ${eliminacion.objetivo?.etiqueta}. Solo se pueden eliminar tareas de las que no haya nacido una obra; si el trabajo se cancelo, dejala en estado Suspendido.`}
        procesando={eliminacion.procesando}
        error={eliminacion.error}
        onCancelar={eliminacion.cancelar}
        onConfirmar={eliminacion.confirmar}
      />
    </div>
  )
}
