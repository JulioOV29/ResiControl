import { redirect } from 'next/navigation'

export default function Home() {
  // Sin sesion, el layout de la app redirige a /login.
  redirect('/dashboard')
}
