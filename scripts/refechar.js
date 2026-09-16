/**
 * Pone las fechas del juego de datos del prototipo dentro de un rango que
 * termina hoy, sin tocar nada mas.
 *
 *   npm run refechar
 *
 * El Excel original traia fechas por delante del dia de hoy, y eso estorbaba
 * al cargar avances: un avance no puede ser anterior al registro que continua,
 * asi que la mitad de las obras no admitian uno con fecha de hoy.
 *
 * Las fechas nuevas vienen ya calculadas en scripts/datos-prototipo.json, de
 * modo que volver a importar desde cero deja exactamente lo mismo.
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const datos = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'datos-prototipo.json'), 'utf8'),
)

const aFecha = (texto) => new Date(`${texto}T00:00:00.000Z`)
const aTexto = (fecha) => fecha.toISOString().slice(0, 10)

async function main() {
  const hoy = aTexto(new Date())
  let actualizados = 0
  let sinCambio = 0
  let noEncontrados = 0

  // --- 1) Los registros que abren obra toman su fecha nueva -----------------
  for (const r of datos.registros) {
    const existente = await prisma.registroEjecucion.findUnique({
      where: { codigoRegistro: r.codigo },
      select: { id: true, fechaEjecucion: true },
    })

    if (!existente) {
      noEncontrados++
      continue
    }

    if (aTexto(existente.fechaEjecucion) === r.fecha) {
      sinCambio++
      continue
    }

    await prisma.registroEjecucion.update({
      where: { id: existente.id },
      data: { fechaEjecucion: aFecha(r.fecha) },
    })
    actualizados++
  }

  // --- 2) Los subregistros se reacomodan detras de su obra ------------------
  // Si un avance quedo con fecha anterior a la del dia que continua, se corre
  // al dia siguiente. Se recorre la cadena en orden para que el arrastre se
  // propague hasta el ultimo avance.
  let avancesCorridos = 0

  const aperturas = await prisma.registroEjecucion.findMany({
    where: { registroOrigenId: null },
    select: { id: true, fechaEjecucion: true },
  })

  for (const apertura of aperturas) {
    const avances = await prisma.registroEjecucion.findMany({
      where: { registroOrigenId: apertura.id },
      orderBy: { numeroAvance: 'asc' },
      select: { id: true, fechaEjecucion: true },
    })

    let anterior = apertura.fechaEjecucion

    for (const avance of avances) {
      if (avance.fechaEjecucion >= anterior) {
        anterior = avance.fechaEjecucion
        continue
      }

      const corregida = new Date(anterior)
      corregida.setUTCDate(corregida.getUTCDate() + 1)

      await prisma.registroEjecucion.update({
        where: { id: avance.id },
        data: { fechaEjecucion: corregida },
      })

      anterior = corregida
      avancesCorridos++
    }
  }

  // --- 3) Resumen ----------------------------------------------------------
  const todos = await prisma.registroEjecucion.findMany({
    select: { fechaEjecucion: true },
    orderBy: { fechaEjecucion: 'asc' },
  })

  const futuros = todos.filter((r) => aTexto(r.fechaEjecucion) > hoy).length

  console.log('')
  console.log(`  Fechas actualizadas: ${actualizados}`)
  console.log(`  Ya estaban bien:     ${sinCambio}`)
  if (noEncontrados) console.log(`  No estaban en la base: ${noEncontrados}`)
  if (avancesCorridos) console.log(`  Subregistros recolocados: ${avancesCorridos}`)
  console.log('  ------------------------------------------')
  if (todos.length) {
    console.log(`  Rango: ${aTexto(todos[0].fechaEjecucion)} a ${aTexto(todos[todos.length - 1].fechaEjecucion)}`)
  }
  console.log(`  Hoy:   ${hoy}`)
  console.log(
    futuros === 0
      ? '  Ningun registro queda con fecha posterior a hoy.'
      : `  Atencion: ${futuros} registro(s) siguen con fecha futura.`,
  )
  console.log('')
}

main()
  .catch((error) => {
    console.error('\n  ' + error.message + '\n')
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
