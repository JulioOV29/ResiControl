/**
 * Respaldo completo de la base a un archivo JSON.
 *
 *   npm run respaldo
 *
 * Existe por una razon concreta: un cambio de esquema mal dado borro los datos
 * una vez. Cuesta diez segundos correrlo y es la diferencia entre rehacer el
 * trabajo de una semana o no.
 *
 * Guarda una tabla por clave, con las filas tal como salen de la base. Los
 * Decimal y las fechas se escriben como texto para que el JSON sea fiel.
 * Se restaura con: npm run restaurar respaldos/<archivo>.json
 *
 * Con --suave no interrumpe nada si falla: lo usa el respaldo automatico que
 * corre al arrancar "npm run dev". Un respaldo que no se pudo hacer no puede
 * dejarte sin poder trabajar, pero tampoco debe pasar en silencio, asi que
 * avisa y sigue.
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// El orden importa al restaurar: cada tabla va despues de aquellas a las que
// apunta. Aqui solo se usa para leer, pero se comparte con restaurar.js.
const TABLAS = [
  'usuario',
  'proyecto',
  'torre',
  'piso',
  'zona',
  'elementoConstructivo',
  'actividad',
  'cargo',
  'trabajador',
  'trabajadorActividad',
  'cuadrilla',
  'cuadrillaTrabajador',
  'meta',
  'tarea',
  'registroEjecucion',
]

/** Decimal y Date -> texto, para que el JSON no pierda precision ni zona. */
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

/** Cuantos respaldos se conservan. Los mas viejos se van borrando solos. */
const MAXIMO = 30

async function main() {
  const contenido = { generado: new Date().toISOString(), tablas: {} }

  for (const tabla of TABLAS) {
    const filas = await prisma[tabla].findMany()
    contenido.tablas[tabla] = serializar(filas)
    console.log(`${tabla.padEnd(22)} ${filas.length} filas`)
  }

  const carpeta = path.join(__dirname, '..', 'respaldos')
  fs.mkdirSync(carpeta, { recursive: true })

  const sello = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const nombre = `respaldo-${sello.getFullYear()}-${p(sello.getMonth() + 1)}-${p(sello.getDate())}-${p(sello.getHours())}${p(sello.getMinutes())}.json`
  const destino = path.join(carpeta, nombre)

  fs.writeFileSync(destino, JSON.stringify(contenido, null, 2), 'utf8')
  console.log(`\nRespaldo guardado en respaldos/${nombre}`)

  // Se conservan los ultimos MAXIMO, para que la carpeta no crezca sin fin.
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
