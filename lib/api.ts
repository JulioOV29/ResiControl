import { NextResponse } from 'next/server'
import { Prisma, type RolUsuario } from '@prisma/client'
import { ZodError } from 'zod'
import { sesionActual, permisos } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Error de negocio con codigo HTTP explicito. */
export class ErrorApi extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
  }
}

/**
 * Convierte Decimal de Prisma a numero y Date a texto ISO, de forma recursiva.
 * Sin esto los Decimal viajan al cliente como cadenas y romperian cualquier
 * calculo o comparacion en el frontend.
 */
export function serializar<T>(valor: T): unknown {
  if (valor === null || valor === undefined) return valor
  if (Prisma.Decimal.isDecimal(valor)) return Number(valor.toString())
  if (valor instanceof Date) return valor.toISOString()
  if (Array.isArray(valor)) return valor.map(serializar)
  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {}
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = serializar(v)
    }
    return salida
  }
  return valor
}

export function ok(datos: unknown, estado = 200) {
  return NextResponse.json(serializar(datos), { status: estado })
}

export function fallo(mensaje: string, estado = 400, detalle?: unknown) {
  return NextResponse.json({ error: mensaje, detalle }, { status: estado })
}

/** Traduce cualquier excepcion a una respuesta HTTP consistente. */
export function manejarError(error: unknown) {
  if (error instanceof ErrorApi) {
    return fallo(error.message, error.estado)
  }

  if (error instanceof ZodError) {
    const detalle = error.issues.map((i) => ({
      campo: i.path.join('.'),
      mensaje: i.message,
    }))
    return fallo('Los datos enviados no son validos', 422, detalle)
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const campos = (error.meta?.target as string[] | undefined)?.join(', ')
      return fallo(
        campos ? `Ya existe un registro con ese valor en: ${campos}` : 'El registro ya existe',
        409,
      )
    }
    if (error.code === 'P2003') {
      return fallo('La referencia indicada no existe', 409)
    }
    if (error.code === 'P2025') {
      return fallo('No se encontro el registro', 404)
    }
    if (error.code === 'P2014') {
      return fallo('No se puede eliminar: tiene informacion asociada', 409)
    }
  }

  console.error('[api]', error)
  const mensaje = error instanceof Error ? error.message : 'Error interno del servidor'
  return fallo(mensaje, 500)
}

/**
 * Exige sesion activa. Solo lee la cookie firmada: no toca la base.
 *
 * Basta para las lecturas. La cookie esta firmada con NEXTAUTH_SECRET, asi que
 * no se puede falsificar, y lo peor que puede pasar con una sesion que quedo
 * obsoleta es que alguien consulte datos unos minutos de mas. Cobrarle una
 * consulta a la base a cada GET si costaba caro: el panel hace nueve peticiones
 * y las nueve repetian el mismo SELECT del usuario contra un Postgres remoto.
 */
export async function exigirSesion() {
  const sesion = await sesionActual()
  if (!sesion?.user) throw new ErrorApi(401, 'Debes iniciar sesion')
  return sesion
}

/**
 * Exige sesion y permiso, comprobando contra la base que el usuario siga
 * existiendo y habilitado.
 *
 * Aqui si vale la consulta, porque de aqui cuelga todo lo que escribe. La
 * sesion viaja en una cookie y no en la base, asi que sobrevive a que el
 * usuario se borre o se desactive, e incluso a rehacer la base entera: sin esta
 * comprobacion, guardar un registro fallaba con un error de llave foranea
 * ilegible, y ahora responde que hay que volver a iniciar sesion.
 *
 * El rol tambien sale de la base y no de la cookie, para que quitarle permisos
 * a alguien surta efecto de inmediato en lugar de esperar a que caduque su
 * sesion.
 */
export async function exigirPermiso(accion: keyof typeof permisos) {
  const sesion = await exigirSesion()

  const usuario = await prisma.usuario.findUnique({
    where: { id: sesion.user.id },
    select: { id: true, rol: true, activo: true },
  })

  if (!usuario) {
    throw new ErrorApi(401, 'Tu sesion ya no es valida: cierra sesion y vuelve a entrar')
  }
  if (!usuario.activo) {
    throw new ErrorApi(403, 'Tu cuenta esta desactivada')
  }
  if (!permisos[accion].includes(usuario.rol as RolUsuario)) {
    throw new ErrorApi(403, 'Tu rol no tiene permiso para esta accion')
  }

  return {
    ...sesion,
    user: { ...sesion.user, id: usuario.id, rol: usuario.rol },
  }
}

/** Lee un id numerico de los parametros de ruta. */
export async function idDeRuta(params: Promise<{ id: string }>) {
  const { id } = await params
  const numero = Number(id)
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErrorApi(400, 'Identificador invalido')
  }
  return numero
}
