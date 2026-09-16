import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { sesionActual } from '@/lib/auth'

export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual()

  if (!sesion?.user) redirect('/login')

  return (
    <AppShell
      usuario={{
        nombre: sesion.user.nombre,
        apellido: sesion.user.apellido,
        rol: sesion.user.rol,
      }}
    >
      {children}
    </AppShell>
  )
}
