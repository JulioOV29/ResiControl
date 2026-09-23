'use client'

import { useSession } from 'next-auth/react'
import { puede } from '@/lib/dominio'

/**
 * Permisos del usuario en el cliente. Sirve solo para mostrar u ocultar
 * botones: la autorizacion de verdad la aplica cada API Route en el servidor.
 *
 * Lee la misma tabla que el servidor (lib/dominio.ts), para que no puedan
 * discrepar: antes las condiciones estaban escritas a mano aqui y cambiar un
 * permiso obligaba a acordarse de los dos sitios.
 */
export function usePuede() {
  const { data } = useSession()
  const rol = data?.user?.rol

  return {
    rol,
    gestionar: puede(rol, 'gestionar'),
    registrar: puede(rol, 'registrar'),
    administrar: puede(rol, 'administrar'),
    consultar: puede(rol, 'consultar'),
  }
}
