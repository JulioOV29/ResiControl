import { Construction } from 'lucide-react'

export default function EnConstruccion({
  titulo,
  descripcion,
  fase,
}: {
  titulo: string
  descripcion: string
  fase: string
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-obra-900">{titulo}</h1>
      <p className="mt-1 text-sm text-obra-500">{descripcion}</p>

      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-obra-300 bg-white px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-acento-100">
          <Construction className="h-6 w-6 text-acento-600" />
        </div>
        <p className="mt-4 font-medium text-obra-900">Modulo pendiente</p>
        <p className="mt-1 max-w-sm text-sm text-obra-500">
          Se construye en la {fase} del plan de desarrollo.
        </p>
      </div>
    </div>
  )
}
