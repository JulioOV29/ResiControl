import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { relacionesLiquidacion } from '@/lib/liquidaciones'
import { num } from '@/lib/calculos'

type Contexto = { params: Promise<{ id: string }> }

/** Liquidacion con sus renglones y jornadas pagadas. */
export async function GET(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('liquidar')
    const id = await idDeRuta(params)

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
      include: {
        ...relacionesLiquidacion,
        registros: {
          orderBy: [{ fechaEjecucion: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            codigoRegistro: true,
            fechaEjecucion: true,
            m2Ejecutados: true,
            valorM2: true,
            actividad: { select: { nombre: true, unidadMedida: true } },
            elemento: { select: { codigoDwg: true, descripcion: true } },
          },
        },
      },
    })
    if (!liquidacion) throw new ErrorApi(404, 'La liquidacion no existe')

    return ok({
      ...liquidacion,
      registros: liquidacion.registros.map((r) => ({
        id: r.id,
        codigoRegistro: r.codigoRegistro,
        fechaEjecucion: r.fechaEjecucion,
        actividad: r.actividad.nombre,
        unidad: r.actividad.unidadMedida,
        cantidad: num(r.m2Ejecutados),
        valorUnitario: num(r.valorM2),
        subtotal: Math.round(num(r.m2Ejecutados) * num(r.valorM2) * 100) / 100,
        elemento: `${r.elemento.codigoDwg} ${r.elemento.descripcion}`,
      })),
    })
  } catch (error) {
    return manejarError(error)
  }
}

/** Anula una liquidacion: sus jornadas vuelven a quedar pendientes. Solo ADMIN. */
export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('administrar')
    const id = await idDeRuta(params)

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
      select: { codigo: true },
    })
    if (!liquidacion) throw new ErrorApi(404, 'La liquidacion no existe')

    await prisma.$transaction([
      prisma.registroEjecucion.updateMany({
        where: { liquidacionId: id },
        data: { liquidacionId: null },
      }),
      prisma.liquidacion.delete({ where: { id } }),
    ])

    return ok({ mensaje: `Liquidacion ${liquidacion.codigo} anulada` })
  } catch (error) {
    return manejarError(error)
  }
}
