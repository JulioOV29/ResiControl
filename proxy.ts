// En Next.js 16 el middleware se llama proxy.ts. Aqui solo se decide si la
// peticion llega o no a una ruta protegida; los permisos finos por rol se
// validan en cada API Route con exigirPermiso().
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
    '/informes/:path*',
    '/usuarios/:path*',
  ],
}
