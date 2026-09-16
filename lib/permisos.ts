'use client'

import { useSession } from 'next-auth/react'

/**
 * Permisos del usuario en el cliente. Sirve solo para mostrar u ocultar
 * botones: la autorizacion de verdad la aplica cada API Route en el servidor.
 */
export function usePuede() {
  const { data } = useSession()
  const rol = data?.user?.rol

  return {
    rol,
    gestionar: rol === 'ADMIN' || rol === 'RESIDENTE',
    registrar: rol === 'ADMIN' || rol === 'RESIDENTE',
    administrar: rol === 'ADMIN',
  }
}
