import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaUsuarioEdicion } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

const camposPublicos = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  rol: true,
  activo: true,
  createdAt: true,
} as const

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const sesion = await exigirPermiso('administrar')
    const id = await idDeRuta(params)
    const { password, ...datos } = esquemaUsuarioEdicion.parse(await request.json())

    // Nadie puede quitarse a si mismo el rol de administrador ni desactivarse,
    // porque el sistema quedaria sin nadie que pueda gestionar usuarios.
    if (id === sesion.user.id && (datos.rol !== 'ADMIN' || !datos.activo)) {
      throw new ErrorApi(409, 'No puedes quitarte a ti mismo el acceso de administrador')
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data: password ? { ...datos, passwordHash: await bcrypt.hash(password, 10) } : datos,
      select: camposPublicos,
    })
    return ok(actualizado)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    const sesion = await exigirPermiso('administrar')
    const id = await idDeRuta(params)

    if (id === sesion.user.id) {
      throw new ErrorApi(409, 'No puedes eliminar tu propia cuenta')
    }

    await prisma.usuario.delete({ where: { id } })
    return ok({ mensaje: 'Usuario eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
