import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { sesionActual } from '@/lib/auth'
import { puede, type Accion, type Rol } from '@/lib/dominio'
import { prisma } from '@/lib/prisma'

/** Error de negocio con codigo HTTP explicito. */
export class ErrorApi extends Error {
  constructor(
    public estado: number,
    mensaje: string,
    /**
     * Codigo corto para que la pantalla sepa que tipo de rechazo es y lo
     * muestre como debe (por ejemplo, SIN_PRECIO abre una ventana de error).
     */
    public codigo?: string,
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

export function fallo(mensaje: string, estado = 400, detalle?: unknown, codigo?: string) {
  return NextResponse.json({ error: mensaje, detalle, codigo }, { status: estado })
}

/** Traduce cualquier excepcion a una respuesta HTTP consistente. */
export function manejarError(error: unknown) {
  if (error instanceof ErrorApi) {
    return fallo(error.message, error.estado, undefined, error.codigo)
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
   * Lo que la base rechaza por sus propias reglas y Prisma no clasifica: borrar
   * algo de lo que dependen otros datos (llave foranea con RESTRICT, codigo
   * 23001 o 23503) o romper un CHECK (23514). Antes salian como "Error interno
   * del servidor"; son conflictos con los datos y se dicen como tales.
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

  // El detalle se queda en el log del servidor. Devolverlo al navegador
  // significaba exponer mensajes de Prisma, con nombres de tablas y columnas,
  // a cualquiera que provocara un fallo. En desarrollo si se muestra, que es
  // cuando hace falta para depurar.
  console.error('[api]', error)
  const detalle =
    process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
  return fallo('Error interno del servidor', 500, detalle)
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
export async function exigirPermiso(accion: Accion) {
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
  if (!puede(usuario.rol as Rol, accion)) {
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
