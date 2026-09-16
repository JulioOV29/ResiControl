'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { HardHat, Loader2, LockKeyhole, Mail } from 'lucide-react'
import { Boton } from '@/components/ui/button'
import { Campo, Entrada } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)

    const resultado = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })

    if (resultado?.error) {
      setError('Correo o contrasena incorrectos, o la cuenta esta desactivada.')
      setCargando(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen">
      {/* Panel de marca: solo desde escritorio */}
      <section className="hidden w-1/2 flex-col justify-between bg-obra-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-acento-500">
            <HardHat className="h-6 w-6 text-obra-900" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ResiControl</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Registrar una vez, calcular automaticamente y reutilizar la informacion
            muchas veces.
          </h1>
          <p className="mt-4 text-obra-300">
            Produccion, tiempos, rendimiento, cumplimiento y avance de obra, calculados
            a partir de un solo registro de ejecucion.
          </p>
        </div>

        <p className="text-xs text-obra-400">
          Sistema de gestion y analisis de informacion de obra
        </p>
      </section>

      {/* Formulario */}
      <section className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-obra-900">
              <HardHat className="h-6 w-6 text-acento-500" />
            </div>
            <span className="text-lg font-semibold text-obra-900">ResiControl</span>
          </div>

          <h2 className="text-2xl font-semibold text-obra-900">Iniciar sesion</h2>
          <p className="mt-1 text-sm text-obra-500">
            Ingresa con las credenciales que te asigno el administrador.
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-5">
            <Campo etiqueta="Correo" htmlFor="email" requerido>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-obra-400" />
                <Entrada
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="pl-9"
                  placeholder="residente@obra.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </Campo>

            <Campo etiqueta="Contrasena" htmlFor="password" requerido>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-obra-400" />
                <Entrada
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="pl-9"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </Campo>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Boton type="submit" className="w-full" tamano="lg" disabled={cargando}>
              {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
              {cargando ? 'Verificando...' : 'Entrar'}
            </Boton>
          </form>
        </div>
      </section>
    </main>
  )
}
