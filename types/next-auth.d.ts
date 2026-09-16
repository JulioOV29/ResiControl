import type { RolUsuario } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: number
      nombre: string
      apellido: string
      rol: RolUsuario
    } & DefaultSession['user']
  }

  interface User {
    id: string
    nombre: string
    apellido: string
    rol: RolUsuario
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: number
    nombre: string
    apellido: string
    rol: RolUsuario
  }
}
