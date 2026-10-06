'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  HardHat,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Target,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import type { RolUsuario } from '@prisma/client'
import { cn } from '@/lib/utils'
import { ETIQUETA_ROL } from '@/lib/dominio'

type ItemNav = {
  href: string
  etiqueta: string
  icono: React.ComponentType<{ className?: string }>
  roles?: RolUsuario[]
}

type GrupoNav = { titulo: string; items: ItemNav[] }

const navegacion: GrupoNav[] = [
  {
    titulo: 'Operaciones',
    items: [
      { href: '/dashboard', etiqueta: 'Panel', icono: LayoutDashboard },
      { href: '/tareas', etiqueta: 'Asignar tareas', icono: ClipboardCheck },
      { href: '/ejecucion', etiqueta: 'Registros de obra', icono: ClipboardList },
      {
        href: '/liquidaciones',
        etiqueta: 'Liquidaciones',
        icono: Wallet,
        roles: ['ADMIN', 'RESIDENTE'],
      },
    ],
  },
  {
    titulo: 'Gestion',
    items: [
      { href: '/proyectos', etiqueta: 'Proyectos', icono: Building2 },
      { href: '/actividades', etiqueta: 'Actividades', icono: ListChecks },
      { href: '/metas', etiqueta: 'Metas', icono: Target },
      { href: '/cuadrillas', etiqueta: 'Cuadrillas', icono: Users },
      { href: '/trabajadores', etiqueta: 'Trabajadores', icono: HardHat },
      { href: '/cargos', etiqueta: 'Cargos', icono: Wrench },
    ],
  },
  {
    titulo: 'Sistema',
    items: [{ href: '/usuarios', etiqueta: 'Usuarios', icono: UserCog, roles: ['ADMIN'] }],
  },
]

/** Nombre corto del rol. */
const cargoCorto = (rol: RolUsuario) => ETIQUETA_ROL[rol].split(':')[0]

export default function AppShell({
  usuario,
  children,
}: {
  usuario: { nombre: string; apellido: string; rol: RolUsuario }
  children: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const pathname = usePathname()

  const grupos = navegacion
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => !item.roles || item.roles.includes(usuario.rol)),
    }))
    .filter((grupo) => grupo.items.length > 0)

  const iniciales = `${usuario.nombre[0] ?? ''}${usuario.apellido[0] ?? ''}`.toUpperCase()

  /** Seccion actual, para el titulo de la barra superior. */
  const seccion = grupos
    .flatMap((g) => g.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  const IconoSeccion = seccion?.icono

  return (
    <div className="min-h-screen bg-obra-50 lg:flex">
      {/* Fondo oscuro del menu en movil */}
      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-obra-900/40 lg:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-obra-100 bg-white',
          'transform transition-transform duration-300 ease-in-out',
          abierto ? 'translate-x-0' : '-translate-x-full',
          // En escritorio el menu queda fijo a la izquierda: no se mueve con el scroll.
          // Si no cabe, se desplaza solo la lista de opciones.
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5"
            onClick={() => setAbierto(false)}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-600 shadow-sm shadow-marca-600/30">
              <HardHat className="h-5 w-5 text-white" />
            </div>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-obra-900">
                ResiControl
              </span>
              <span className="block text-xs text-obra-400">Control de obras</span>
            </span>
          </Link>
          <button
            onClick={() => setAbierto(false)}
            className="rounded-lg p-1.5 text-obra-400 hover:bg-obra-100 hover:text-obra-700 lg:hidden"
            aria-label="Cerrar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Saludo */}
        <div className="mx-4 mb-5 rounded-xl bg-obra-50 px-4 py-3">
          <p className="text-xs text-obra-500">Hola,</p>
          <p className="truncate text-sm font-semibold text-obra-900">
            {usuario.nombre} {usuario.apellido}
          </p>
          <p className="text-xs text-marca-700">{cargoCorto(usuario.rol)}</p>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="px-3 pb-1.5 text-xs font-medium text-obra-400">
                {grupo.titulo}
              </p>
              <ul className="space-y-0.5">
                {grupo.items.map((item) => {
                  const activo = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icono = item.icono
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setAbierto(false)}
                        aria-current={activo ? 'page' : undefined}
                        className={cn(
                          'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          // marca-700 para tener buen contraste sobre el fondo claro.
                          // La barrita de la izquierda marca la pagina actual.
                          activo
                            ? 'bg-marca-50 font-semibold text-marca-700 before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-marca-600'
                            : 'text-obra-600 hover:bg-obra-50 hover:text-obra-900',
                        )}
                      >
                        <Icono
                          className={cn(
                            'h-[18px] w-[18px]',
                            activo ? 'text-marca-600' : 'text-obra-400',
                          )}
                        />
                        {item.etiqueta}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-obra-100 bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            onClick={() => setAbierto(true)}
            className="-ml-1 rounded-lg p-2 text-obra-600 hover:bg-obra-100 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Seccion actual */}
          <div className="flex min-w-0 items-center gap-2.5">
            {IconoSeccion && (
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-obra-50 text-obra-500 sm:flex">
                <IconoSeccion className="h-4 w-4" />
              </span>
            )}
            <span className="truncate font-semibold text-obra-900">
              {seccion?.etiqueta ?? 'ResiControl'}
            </span>
          </div>

          {/* Usuario conectado */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-obra-900">
                {usuario.nombre} {usuario.apellido}
              </p>
              <p className="text-xs text-obra-500">{cargoCorto(usuario.rol)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca-100 text-xs font-semibold text-marca-700 ring-2 ring-white">
              {iniciales}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="rounded-lg p-2 text-obra-400 hover:bg-obra-100 hover:text-obra-700"
              title="Cerrar sesion"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
