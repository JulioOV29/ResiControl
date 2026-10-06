/**
 * Restaura un respaldo hecho con npm run respaldo.
 *
 *   npm run restaurar respaldos/respaldo-2026-09-24-0930.json
 *
 * Inserta las filas con sus ids originales, salta las que ya existen y ajusta
 * los contadores de id. No borra nada.
 */
require('dotenv').config()

const fs = require('fs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Modelo, tabla y columna de id (para ajustar la secuencia).
const TABLAS = [
  ['usuario', 'usuarios', 'id_usuario'],
  ['proyecto', 'proyectos', 'id_proyecto'],
  ['torre', 'torres', 'id_torre'],
  ['piso', 'pisos', 'id_piso'],
  ['zona', 'zonas', 'id_zona'],
  ['elementoConstructivo', 'elementos_constructivos', 'id_elemento'],
  ['vano', 'vanos', 'id_vano'],
  ['actividad', 'actividades', 'id_actividad'],
  ['cargo', 'cargos', 'id_cargo'],
  ['trabajador', 'trabajadores', 'id_trabajador'],
  ['trabajadorActividad', 'trabajador_actividad', 'id_trabajador_actividad'],
  ['cuadrilla', 'cuadrillas', 'id_cuadrilla'],
  ['cuadrillaTrabajador', 'cuadrilla_trabajador', 'id_cuadrilla_trabajador'],
  ['meta', 'metas', 'id_meta'],
  ['tarea', 'tareas', 'id_tarea'],
  ['liquidacion', 'liquidaciones', 'id_liquidacion'],
  ['liquidacionLinea', 'liquidacion_lineas', 'id_liquidacion_linea'],
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

  // Respaldos viejos sin cantidad_total: se completa (ml = largo, lo demas largo x alto).
  const unidadDe = new Map(
    (contenido.tablas?.actividad ?? []).map((a) => [a.id, a.unidadMedida]),
  )
  for (const r of contenido.tablas?.registroEjecucion ?? []) {
    if (r.registroOrigenId !== null || (r.cantidadTotal !== undefined && r.cantidadTotal !== null)) continue
    const largo = Number(r.largo)
    const alto = Number(r.alto)
    r.cantidadTotal =
      unidadDe.get(r.actividadId) === 'ml' ? largo : Math.round(largo * alto * 100) / 100
  }

  // Todo o nada: si una tabla falla, no queda la base a medio restaurar.
  await prisma.$transaction(
    async (tx) => {
      for (const [modelo, tabla, columnaId] of TABLAS) {
        const filas = contenido.tablas?.[modelo] ?? []
        if (filas.length === 0) {
          console.log(`${modelo.padEnd(22)} sin filas`)
          continue
        }

        /** Primero las aperturas y despues los avances (un avance apunta a otro registro). */
        const tandas =
          modelo === 'registroEjecucion'
            ? [filas.filter((f) => f.registroOrigenId === null), filas.filter((f) => f.registroOrigenId !== null)]
            : [filas]

        let insertadas = 0
        for (const tanda of tandas) {
          if (tanda.length === 0) continue
          const r = await tx[modelo].createMany({ data: tanda, skipDuplicates: true })
          insertadas += r.count
        }

        // Ajusta el contador de id.
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('${tabla}', '${columnaId}'), COALESCE((SELECT MAX(${columnaId}) FROM ${tabla}), 1))`,
        )

        console.log(`${modelo.padEnd(22)} ${insertadas} de ${filas.length} insertadas`)
      }
    },
    { timeout: 10 * 60 * 1000, maxWait: 30 * 1000 },
  )

  console.log('\nRestauracion terminada.')
}

main()
  .catch((e) => {
    console.error('No se pudo restaurar:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
