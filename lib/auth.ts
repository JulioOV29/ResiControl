import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * Cuantos intentos fallidos seguidos se admiten y cuanto dura el bloqueo.
 *
 * El contador vive en la base (columnas intentos_fallidos y bloqueado_hasta):
 * en Vercel cada peticion puede caer en una instancia distinta, asi que un
 * contador en memoria no frenaria a nadie.
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

        // Cuenta inexistente o desactivada: se responde igual que una
        // contrasena incorrecta para no revelar que correos existen.
        if (!usuario || !usuario.activo) return null

        /**
         * Cuenta bloqueada: se avisa con todas las letras y ni se comprueba la
         * contrasena, para que el bloqueo sirva de algo.
         *
         * El aviso dice que ESE correo esta bloqueado, asi que le confirma a
         * quien pregunte que la cuenta existe. Se acepta a conciencia: es un
         * sistema interno de obra, y un residente que no entiende por que no
         * entra con su clave buena cuesta mas que ese dato.
         */
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
          const fallidos = usuario.intentosFallidos + 1
          const bloquear = fallidos >= INTENTOS_MAXIMOS
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
              // Al bloquear, el contador vuelve a cero: lo que cuenta a partir
              // de ahi es la fecha de desbloqueo.
              intentosFallidos: bloquear ? 0 : fallidos,
              bloqueadoHasta: bloquear
                ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000)
                : null,
            },
          })

          // El intento que agota los reintentos ya avisa del bloqueo, en vez de
          // dejar que el usuario descubra en el siguiente que algo cambio.
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

/** Sesion actual en Server Components y API Routes. */
export function sesionActual() {
  return getServerSession(authOptions)
}

/**
 * La tabla de permisos vive en lib/dominio.ts, que no depende de nada del
 * servidor, para que el cliente pueda leer la misma sin arrastrar Prisma. Aqui
 * solo se reexporta, que es donde el codigo del servidor la busca.
 */
export { PERMISOS as permisos, puede } from '@/lib/dominio'
export type { Accion } from '@/lib/dominio'
