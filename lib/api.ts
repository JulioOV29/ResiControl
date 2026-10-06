import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { sesionActual } from '@/lib/auth'
import { puede, type Accion, type Rol } from '@/lib/dominio'
import { prisma } from '@/lib/prisma'

/** Error de negocio con su codigo HTTP. */
export class ErrorApi extends Error {
  constructor(
    public estado: number,
    mensaje: string,
    /** Codigo opcional para la pantalla (ej. SIN_PRECIO abre una ventana de error). */
    public codigo?: string,
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
  }
}

/** Convierte Decimal a number y Date a texto ISO, en todo el objeto. */
function serializar<T>(valor: T): unknown {
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

function fallo(mensaje: string, estado = 400, detalle?: unknown, codigo?: string) {
  return NextResponse.json({ error: mensaje, detalle, codigo }, { status: estado })
}

/** Convierte cualquier error en una respuesta HTTP. */
export function manejarError(error: unknown) {
  if (error instanceof ErrorApi) {
    return fallo(error.message, error.estado, undefined, error.codigo)
  }

  // Cuerpo que no es JSON valido.
  if (error instanceof SyntaxError) {
    return fallo('Los datos enviados no son JSON valido', 400)
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
      const objetivo = error.meta?.target
      if (String(objetivo ?? '').includes('elemento_actividad') || /elemento_actividad/.test(error.message)) {
        return fallo('Ese elemento ya tiene ese trabajo registrado con esa actividad', 409)
      }
      const campos = Array.isArray(objetivo) ? objetivo.join(', ') : undefined
      return fallo(
        campos ? `Ya existe un registro con ese valor en: ${campos}` : 'El registro ya existe',
        409,
      )
    }
    if (error.code === 'P2003') {
      // Al borrar, significa que otros datos dependen de lo que se borra.
      if (/\.delete(Many)?\(\)/.test(error.message)) {
        return fallo(
          'No se puede eliminar: hay registros, tareas u otros datos que dependen de esto',
          409,
        )
      }
      return fallo('La referencia indicada no existe', 409)
    }
    if (error.code === 'P2025') {
      return fallo('No se encontro el registro', 404)
    }
    if (error.code === 'P2014') {
      return fallo('No se puede eliminar: tiene informacion asociada', 409)
    }
  }

  /**
   * Errores de la base que Prisma no clasifica: llave foranea (23001, 23503)
   * o CHECK (23514). Se responden como conflicto (409), no como error interno.
   */
  if (
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientKnownRequestError
  ) {
    const texto = error.message
    if (/2300[13]|foreign key constraint/i.test(texto)) {
      return fallo(
        'No se puede eliminar: hay registros, tareas u otros datos que dependen de esto',
        409,
      )
    }
    if (/23514|check constraint/i.test(texto)) {
      return fallo('Los datos no cumplen una de las reglas de la base de datos', 409)
    }
    if (/23505|elemento_actividad/i.test(texto)) {
      return fallo('Ese elemento ya tiene ese trabajo registrado con esa actividad', 409)
    }
  }

  // El detalle tecnico solo se muestra en desarrollo.
  console.error('[api]', error)
  const detalle =
    process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
  return fallo('Error interno del servidor', 500, detalle)
}

/**
 * Exige sesion de un usuario que sigue activo. Consulta la base: un usuario
 * desactivado deja de ver datos de inmediato, aunque su cookie siga vigente.
 * Devuelve la sesion con el rol actual.
 */
export async function exigirSesion() {
  const { sesion, usuario } = await usuarioVigente()
  return { ...sesion, user: { ...sesion.user, id: usuario.id, rol: usuario.rol } }
}

/** Exige sesion y permiso para la accion. Se usa en todo lo que escribe. */
export async function exigirPermiso(accion: Accion) {
  const { sesion, usuario } = await usuarioVigente()
  if (!puede(usuario.rol as Rol, accion)) {
    throw new ErrorApi(403, 'Tu rol no tiene permiso para esta accion')
  }
  return { ...sesion, user: { ...sesion.user, id: usuario.id, rol: usuario.rol } }
}

/** Sesion y usuario de la base, si sigue existiendo y activo. */
async function usuarioVigente() {
  const sesion = await sesionActual()
  if (!sesion?.user) throw new ErrorApi(401, 'Debes iniciar sesion')

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
  return { sesion, usuario }
}

/** Lee un id numerico de la ruta. */
export async function idDeRuta(params: Promise<{ id: string }>) {
  const { id } = await params
  const numero = Number(id)
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErrorApi(400, 'Identificador invalido')
  }
  return numero
}

/** Campos con precios acordados: solo los ven quienes liquidan. */
const CAMPOS_PRECIO = new Set(['valorM2', 'tarifas'])

/** Quita los precios de una respuesta si el rol no puede liquidar. */
export function sinPrecios<T>(datos: T, rol: string): T {
  if (puede(rol as Rol, 'liquidar')) return datos
  const limpiar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(limpiar)
    // Solo objetos simples; Date y Decimal se dejan como estan.
    if (valor && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
      return Object.fromEntries(
        Object.entries(valor)
          .filter(([clave]) => !CAMPOS_PRECIO.has(clave))
          .map(([clave, v]) => [clave, limpiar(v)]),
      )
    }
    return valor
  }
  return limpiar(datos) as T
}
