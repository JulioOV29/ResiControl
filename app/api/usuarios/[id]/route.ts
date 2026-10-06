import bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaUsuarioEdicion } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

/**
 * Impide dejar el sistema sin administradores activos. Va dentro de una
 * transaccion con un candado, asi dos cambios a la vez no se cruzan.
 */
async function exigirOtroAdmin(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(7301)`
  const otros = await tx.usuario.count({
    where: { rol: 'ADMIN', activo: true, id: { not: id } },
  })
  if (otros === 0) {
    throw new ErrorApi(409, 'Tiene que quedar al menos un administrador activo')
  }
}

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

    // Nadie puede quitarse el rol de administrador ni desactivarse a si mismo.
    if (id === sesion.user.id && (datos.rol !== 'ADMIN' || !datos.activo)) {
      throw new ErrorApi(409, 'No puedes quitarte a ti mismo el acceso de administrador')
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null
    const actualizado = await prisma.$transaction(async (tx) => {
      if (datos.rol !== 'ADMIN' || !datos.activo) await exigirOtroAdmin(tx, id)
      return tx.usuario.update({
        where: { id },
        data: passwordHash ? { ...datos, passwordHash } : datos,
        select: camposPublicos,
      })
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

    // Quien ya registro, edito, asigno o liquido algo se desactiva, no se borra (se pierde la autoria).
    const usos = await prisma.usuario.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            registrosCreados: true,
            registrosActualizados: true,
            tareasAsignadas: true,
            liquidacionesHechas: true,
          },
        },
      },
    })
    if (!usos) throw new ErrorApi(404, 'El usuario no existe')
    if (Object.values(usos._count).some((n) => n > 0)) {
      throw new ErrorApi(
        409,
        'No se puede eliminar: este usuario ya registro o modifico informacion. Desactivalo en su lugar.',
      )
    }

    await prisma.$transaction(async (tx) => {
      await exigirOtroAdmin(tx, id)
      await tx.usuario.delete({ where: { id } })
    })
    return ok({ mensaje: 'Usuario eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
