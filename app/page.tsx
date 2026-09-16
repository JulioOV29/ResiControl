import { redirect } from 'next/navigation'

export default function Home() {
  // El layout de la aplicacion redirige a /login cuando no hay sesion.
  redirect('/dashboard')
}
