/**
 * Respaldo completo de la base a un archivo JSON.
 *
 *   npm run respaldo
 *   npm run restaurar respaldos/<archivo>.json
 *
 * Con --suave (lo usa "npm run dev" al arrancar) avisa si falla pero no
 * detiene nada.
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Orden de las tablas: cada una despues de las que referencia (lo usa restaurar.js).
const TABLAS = [
  'usuario',
  'proyecto',
  'torre',
  'piso',
  'zona',
  'elementoConstructivo',
  'vano',
  'actividad',
  'cargo',
  'trabajador',
  'trabajadorActividad',
  'cuadrilla',
  'cuadrillaTrabajador',
  'meta',
  'tarea',
  // Las liquidaciones antes que los registros (un registro pagado apunta a ella).
  'liquidacion',
  'liquidacionLinea',
  'registroEjecucion',
]

/** Decimal y Date -> texto, sin perder precision. */
const serializar = (valor) => {
  if (valor === null || valor === undefined) return valor
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === 'object' && typeof valor.toFixed === 'function') return valor.toString()
  if (Array.isArray(valor)) return valor.map(serializar)
  if (typeof valor === 'object') {
    const salida = {}
    for (const [clave, v] of Object.entries(valor)) salida[clave] = serializar(v)
    return salida
  }
  return valor
}

const SUAVE = process.argv.includes('--suave')

/** Respaldos que se conservan; los mas viejos se borran. */
const MAXIMO = 30

/** Hasta tres intentos: Neon puede tardar unos segundos en despertar. */
async function despertarBase() {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      await prisma.$queryRaw`SELECT 1`
      return
    } catch (error) {
      if (intento === 3) throw error
      console.log(`La base no responde todavia (intento ${intento} de 3), suele estar dormida...`)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

async function main() {
  await despertarBase()

  const contenido = { generado: new Date().toISOString(), tablas: {} }

  // Todas las tablas en una sola foto: lo que se guarde mientras tanto no deja el respaldo a medias.
  const resultados = await prisma.$transaction(
    TABLAS.map((tabla) => prisma[tabla].findMany()),
    { isolationLevel: 'RepeatableRead' },
  )
  TABLAS.forEach((tabla, i) => {
    contenido.tablas[tabla] = serializar(resultados[i])
    console.log(`${tabla.padEnd(22)} ${resultados[i].length} filas`)
  })

  const carpeta = path.join(__dirname, '..', 'respaldos')
  fs.mkdirSync(carpeta, { recursive: true })

  const sello = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const nombre = `respaldo-${sello.getFullYear()}-${p(sello.getMonth() + 1)}-${p(sello.getDate())}-${p(sello.getHours())}${p(sello.getMinutes())}.json`
  const destino = path.join(carpeta, nombre)

  fs.writeFileSync(destino, JSON.stringify(contenido, null, 2), 'utf8')
  console.log(`\nRespaldo guardado en respaldos/${nombre}`)

  // Conserva solo los ultimos MAXIMO.
  const viejos = fs
    .readdirSync(carpeta)
    .filter((f) => f.startsWith('respaldo-') && f.endsWith('.json'))
    .sort()
    .slice(0, -MAXIMO)

  for (const archivo of viejos) fs.unlinkSync(path.join(carpeta, archivo))
  if (viejos.length) console.log(`(se borraron ${viejos.length} respaldos antiguos)`)
}

main()
  .catch((e) => {
    console.error('\nNo se pudo respaldar:', e.message)
    if (SUAVE) {
      console.error('Se sigue de todos modos, pero hoy estas trabajando sin red.\n')
      return
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
