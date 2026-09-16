import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import type { RolUsuario } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    CredentialsProvider({
      name: 'credenciales',
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contrasena', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        })

        // Cuenta inexistente o desactivada: se responde igual que una
        // contrasena incorrecta para no revelar que correos existen.
        if (!usuario || !usuario.activo) return null

        const valida = await bcrypt.compare(credentials.password, usuario.passwordHash)
        if (!valida) return null

        return {
          id: String(usuario.id),
          email: usuario.email,
          name: `${usuario.nombre} ${usuario.apellido}`,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          rol: usuario.rol,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = Number(user.id)
        token.nombre = user.nombre
        token.apellido = user.apellido
        token.rol = user.rol
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.nombre = token.nombre
      session.user.apellido = token.apellido
      session.user.rol = token.rol
      return session
    },
  },
}

/** Sesion actual en Server Components y API Routes. */
export function sesionActual() {
  return getServerSession(authOptions)
}

/** Permisos por rol, en un solo lugar para no repetir condiciones sueltas. */
export const permisos = {
  /** Crear, editar o borrar catalogos, obra, personal y metas. */
  gestionar: ['ADMIN', 'RESIDENTE'] as RolUsuario[],
  /** Crear o editar registros de ejecucion. */
  registrar: ['ADMIN', 'RESIDENTE'] as RolUsuario[],
  /** Administrar usuarios del sistema. */
  administrar: ['ADMIN'] as RolUsuario[],
  /** Consultar dashboard e informes. */
  consultar: ['ADMIN', 'RESIDENTE', 'SUPERVISOR'] as RolUsuario[],
}

export function puede(rol: RolUsuario | undefined, accion: keyof typeof permisos) {
  if (!rol) return false
  return permisos[accion].includes(rol)
}
