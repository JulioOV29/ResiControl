import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaTrabajador } from '@/lib/esquemas'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const { tarifas, ...datos } = esquemaTrabajador.parse(await request.json())

    /**
     * La lista de precios que llega reemplaza a la anterior (en una transaccion).
     * Los precios ya copiados en jornadas guardadas no cambian.
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

    /** Un trabajador con jornadas no se borra; se desactiva. */
    const [jornadas, trabajador] = await Promise.all([
      prisma.registroEjecucion.count({ where: { trabajadorId: id } }),
      prisma.trabajador.findUnique({ where: { id }, select: { nombre: true, apellido: true } }),
    ])
    if (!trabajador) throw new ErrorApi(404, 'El trabajador no existe')
    if (jornadas > 0) {
      throw new ErrorApi(
        409,
        `${trabajador.nombre} ${trabajador.apellido} tiene ${jornadas} jornada${jornadas === 1 ? '' : 's'} registrada${jornadas === 1 ? '' : 's'}: no se puede eliminar. Desactivalo en su ficha para sacarlo de las listas.`,
      )
    }

    await prisma.trabajador.delete({ where: { id } })
    return ok({ mensaje: 'Trabajador eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
