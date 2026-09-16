import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso } from '@/lib/api'
import { esquemaUsuarioNuevo } from '@/lib/esquemas'

/** Nunca se devuelve el hash de la contrasena al cliente. */
const camposPublicos = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  rol: true,
  activo: true,
  createdAt: true,
} as const

export async function GET() {
  try {
    await exigirPermiso('administrar')
    const usuarios = await prisma.usuario.findMany({
      orderBy: [{ activo: 'desc' }, { apellido: 'asc' }],
      select: camposPublicos,
    })
    return ok(usuarios)
  } catch (error) {
    return manejarError(error)
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermiso('administrar')
    const { password, ...datos } = esquemaUsuarioNuevo.parse(await request.json())
    const creado = await prisma.usuario.create({
      data: { ...datos, passwordHash: await bcrypt.hash(password, 10) },
      select: camposPublicos,
    })
    return ok(creado, 201)
  } catch (error) {
    return manejarError(error)
  }
}
