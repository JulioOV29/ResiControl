'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  HardHat,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Target,
  UserCog,
  Users,
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
      { href: '/informes', etiqueta: 'Informes', icono: FileBarChart },
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

/** El rol en corto: la descripcion larga de lib/dominio no cabe bajo el nombre. */
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

  return (
    <div className="min-h-screen bg-obra-50 lg:flex">
      {/* Fondo oscuro al abrir el menu en movil */}
      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-obra-900/40 lg:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-obra-200 bg-white',
          'transform transition-transform duration-300 ease-in-out',
          abierto ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:z-auto lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5"
            onClick={() => setAbierto(false)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-obra-900">
              <HardHat className="h-[18px] w-[18px] text-acento-400" />
            </div>
            <span className="leading-tight">
              <span className="block text-sm font-bold tracking-tight text-obra-900">
                RESICONTROL
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-obra-400">
                Control de obras
              </span>
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

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-obra-400">
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
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          // El texto activo va en marca-700 y no en 600: sobre el
                          // fondo claro de la pastilla, el 600 se queda corto de
                          // contraste para texto.
                          activo
                            ? 'bg-marca-50 font-semibold text-marca-700'
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-obra-200 bg-white px-4 sm:px-6">
          <button
            onClick={() => setAbierto(true)}
            className="-ml-1 rounded-lg p-2 text-obra-600 hover:bg-obra-100 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <span className="font-semibold text-obra-900 lg:hidden">ResiControl</span>

          {/* El bloque de usuario vive aqui y ya no al pie del menu, como en el
              diseno: es lo primero que se mira para saber con que cuenta se
              esta trabajando. */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-obra-900">
                {usuario.nombre} {usuario.apellido}
              </p>
              <p className="text-xs text-obra-500">{cargoCorto(usuario.rol)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-obra-100 text-xs font-semibold text-obra-700">
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
