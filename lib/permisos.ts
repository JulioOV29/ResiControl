'use client'

import { useSession } from 'next-auth/react'
import { puede } from '@/lib/dominio'

/**
 * Permisos del usuario en el navegador. Solo deciden que botones se ven;
 * la API vuelve a validarlos.
 */
export function usePuede() {
  const { data } = useSession()
  const rol = data?.user?.rol

  return {
    rol,
    gestionar: puede(rol, 'gestionar'),
    registrar: puede(rol, 'registrar'),
    administrar: puede(rol, 'administrar'),
    liquidar: puede(rol, 'liquidar'),
    consultar: puede(rol, 'consultar'),
  }
}
