import { prisma } from '@/lib/prisma'
import { ok, manejarError, exigirPermiso, idDeRuta, ErrorApi } from '@/lib/api'
import { esquemaElemento } from '@/lib/esquemas'
import { areaDeVanos } from '@/lib/dominio'

type Contexto = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Contexto) {
  try {
    await exigirPermiso('gestionar')
    const id = await idDeRuta(params)
    const { vanos, ...datos } = esquemaElemento.parse(await request.json())

    // La lista de vanos que llega reemplaza a la anterior. Si no llega, se conservan.
    // Las obras ya abiertas conservan la cantidad que copiaron.
    const actualizado = await prisma.$transaction(async (tx) => {
      if (vanos) {
        await tx.vano.deleteMany({ where: { elementoId: id } })
      } else {
        const actual = await tx.elementoConstructivo.findUnique({
          where: { id },
          select: { areaVanos: true },
        })
        if (actual && Number(actual.areaVanos) >= datos.largo * datos.alto) {
          throw new ErrorApi(409, 'Con esas medidas los vanos ocuparian toda el area del elemento')
        }
      }
      return tx.elementoConstructivo.update({
        where: { id },
        data: vanos
          ? { ...datos, areaVanos: areaDeVanos(vanos), vanos: { create: vanos } }
          : datos,
        include: { vanos: true },
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
    await prisma.elementoConstructivo.delete({ where: { id } })
    return ok({ mensaje: 'Elemento constructivo eliminado' })
  } catch (error) {
    return manejarError(error)
  }
}
