// Proxy de Next.js 16 (antes middleware): exige sesion en las rutas protegidas.
// Los permisos por rol se validan en cada API Route.
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/proyectos/:path*',
    '/actividades/:path*',
    '/cargos/:path*',
    '/trabajadores/:path*',
    '/cuadrillas/:path*',
    '/metas/:path*',
    '/ejecucion/:path*',
    '/tareas/:path*',
    '/liquidaciones/:path*',
    '/usuarios/:path*',
  ],
}
