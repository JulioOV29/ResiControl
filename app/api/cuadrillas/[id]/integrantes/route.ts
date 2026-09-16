import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaAsignacion } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

/**
 * Asigna un trabajador a la cuadrilla. Si ya estaba en otra, esa asignacion se
 * cierra en lugar de borrarse: el historial de quien estuvo donde y cuando es
 * parte del analisis de desempeno.
 */
export async function POST(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const cuadrillaId = await idDeRuta(params)
    const { trabajadorId, fechaInicio } = esquemaAsignacion.parse(await request.json())

    const yaEsta = await prisma.cuadrillaTrabajador.findFirst({
      where: { cuadrillaId, trabajadorId, activo: true },
    })
    if (yaEsta) throw new ErrorApi(409, 'El trabajador ya pertenece a esta cuadrilla')

    const asignacion = await prisma.$transaction(async (tx) => {
      await tx.cuadrillaTrabajador.updateMany({
        where: { trabajadorId, activo: true },
        data: { activo: false, fechaFin: fechaInicio },
      })
      return tx.cuadrillaTrabajador.create({
        data: { cuadrillaId, trabajadorId, fechaInicio, activo: true },
      })
    })

    return ok(asignacion, 201)
  } catch (error) {
    return manejarError(error)
  }
}
