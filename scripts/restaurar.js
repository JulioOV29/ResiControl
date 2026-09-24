/**
 * Restaura un respaldo hecho con npm run respaldo.
 *
 *   npm run restaurar respaldos/respaldo-2026-09-24-0930.json
 *
 * Inserta las filas con sus identificadores originales, en el orden en que se
 * pueden insertar sin romper las llaves foraneas, y salta las que ya existan.
 * Al final pone los contadores de id donde toca, para que lo siguiente que se
 * cree no choque con lo restaurado.
 *
 * No borra nada: si quieres una base limpia, vaciala antes.
 */
require('dotenv').config()

const fs = require('fs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Cada tabla con la tabla real y su columna de id, para recolocar la secuencia.
const TABLAS = [
  ['usuario', 'usuarios', 'id_usuario'],
  ['proyecto', 'proyectos', 'id_proyecto'],
  ['torre', 'torres', 'id_torre'],
  ['piso', 'pisos', 'id_piso'],
  ['zona', 'zonas', 'id_zona'],
  ['elementoConstructivo', 'elementos_constructivos', 'id_elemento'],
  ['actividad', 'actividades', 'id_actividad'],
  ['cargo', 'cargos', 'id_cargo'],
  ['trabajador', 'trabajadores', 'id_trabajador'],
  ['trabajadorActividad', 'trabajador_actividad', 'id_trabajador_actividad'],
  ['cuadrilla', 'cuadrillas', 'id_cuadrilla'],
  ['cuadrillaTrabajador', 'cuadrilla_trabajador', 'id_cuadrilla_trabajador'],
  ['meta', 'metas', 'id_meta'],
  ['tarea', 'tareas', 'id_tarea'],
  ['registroEjecucion', 'registros_ejecucion', 'id_ejecucion'],
]

async function main() {
  const ruta = process.argv[2]
  if (!ruta) {
    console.error('Falta el archivo: npm run restaurar respaldos/<archivo>.json')
    process.exit(1)
  }
  if (!fs.existsSync(ruta)) {
    console.error(`No existe ${ruta}`)
    process.exit(1)
  }

  const contenido = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  console.log(`Respaldo del ${contenido.generado}\n`)

  for (const [modelo, tabla, columnaId] of TABLAS) {
    const filas = contenido.tablas?.[modelo] ?? []
    if (filas.length === 0) {
      console.log(`${modelo.padEnd(22)} sin filas`)
      continue
    }

    /**
     * Los registros de obra se encadenan entre si, asi que primero entran los
     * que abren obra y despues sus avances: un avance no puede apuntar a un
     * registro que todavia no existe.
     */
    const tandas =
      modelo === 'registroEjecucion'
        ? [filas.filter((f) => f.registroOrigenId === null), filas.filter((f) => f.registroOrigenId !== null)]
        : [filas]

    let insertadas = 0
    for (const tanda of tandas) {
      if (tanda.length === 0) continue
      const r = await prisma[modelo].createMany({ data: tanda, skipDuplicates: true })
      insertadas += r.count
    }

    // El contador de id queda donde termino lo restaurado.
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${tabla}', '${columnaId}'), COALESCE((SELECT MAX(${columnaId}) FROM ${tabla}), 1))`,
    )

    console.log(`${modelo.padEnd(22)} ${insertadas} de ${filas.length} insertadas`)
  }

  console.log('\nRestauracion terminada.')
}

main()
  .catch((e) => {
    console.error('No se pudo restaurar:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
