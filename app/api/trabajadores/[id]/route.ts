import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta } from '@/lib/api'
import { esquemaTrabajador } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const { tarifas, ...datos } = esquemaTrabajador.parse(await request.json())

    /**
     * La lista de tarifas que llega es la lista completa: lo que no viene se
     * quita, lo que viene se crea o se actualiza. Todo en una transaccion,
     * para que nunca quede media tabla de precios.
     *
     * Ojo con lo que NO se toca: el valor_m2 copiado en cada jornada ya
     * guardada. Cambiar un precio afecta a lo que se registre de aqui en
     * adelante, no a lo que ya se pago.
     */
    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.trabajadorActividad.deleteMany({
        where: {
          trabajadorId: id,
          ...(tarifas.length ? { actividadId: { notIn: tarifas.map((t) => t.actividadId) } } : {}),
        },
      })

      for (const tarifa of tarifas) {
        await tx.trabajadorActividad.upsert({
          where: {
            trabajadorId_actividadId: { trabajadorId: id, actividadId: tarifa.actividadId },
          },
          update: { valorM2: tarifa.valorM2 },
          create: { trabajadorId: id, actividadId: tarifa.actividadId, valorM2: tarifa.valorM2 },
        })
      }

      return tx.trabajador.update({
        where: { id },
        data: datos,
        include: {
          cargo: { select: { id: true, nombre: true } },
          tarifas: { select: { id: true, actividadId: true, valorM2: true } },
        },
      })
    })
    return ok(actualizado)
  } catch (error) {
    return manejarError(error)
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    await prisma.trabajador.delete({ where: { id } })
    return ok({ mensaje: 'Trabajador eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
