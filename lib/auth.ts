import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * Intentos fallidos permitidos y minutos de bloqueo.
 * El contador se guarda en la base porque en Vercel no hay memoria compartida.
 */
const INTENTOS_MAXIMOS = 5
const BLOQUEO_MINUTOS = 15

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

        // Cuenta inexistente o inactiva: misma respuesta que clave incorrecta.
        if (!usuario || !usuario.activo) return null

        /** Cuenta bloqueada: se avisa sin revisar la contrasena. */
        if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
          const minutos = Math.max(
            1,
            Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60_000),
          )
          throw new Error(
            `Usuario bloqueado por ${INTENTOS_MAXIMOS} intentos fallidos. Vuelve a intentarlo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
          )
        }

        const valida = await bcrypt.compare(credentials.password, usuario.passwordHash)

        if (!valida) {
          // Suma en la base (no en memoria): intentos en paralelo cuentan todos.
          const { intentosFallidos } = await prisma.usuario.update({
            where: { id: usuario.id },
            data: { intentosFallidos: { increment: 1 } },
            select: { intentosFallidos: true },
          })
          const bloquear = intentosFallidos >= INTENTOS_MAXIMOS
          if (bloquear) {
            // Al bloquear se reinicia el contador; manda la fecha de desbloqueo.
            await prisma.usuario.update({
              where: { id: usuario.id },
              data: {
                intentosFallidos: 0,
                bloqueadoHasta: new Date(Date.now() + BLOQUEO_MINUTOS * 60_000),
              },
            })
          }

          if (bloquear) {
            throw new Error(
              `Usuario bloqueado por ${INTENTOS_MAXIMOS} intentos fallidos. Vuelve a intentarlo en ${BLOQUEO_MINUTOS} minutos.`,
            )
          }

          return null
        }

        // Entro bien: se limpia el contador.
        if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: { intentosFallidos: 0, bloqueadoHasta: null },
          })
        }

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

/** Sesion actual (servidor). */
export function sesionActual() {
  return getServerSession(authOptions)
}

/** Los permisos viven en lib/dominio.ts para que el cliente tambien los use. */
export { PERMISOS as permisos, puede } from '@/lib/dominio'
export type { Accion } from '@/lib/dominio'
