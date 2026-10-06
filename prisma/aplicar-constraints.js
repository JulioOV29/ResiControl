/**
 * Aplica prisma/constraints.sql en la base.
 * Correr despues de cada "prisma db push", que puede borrar esas reglas.
 *
 *   npm run db:constraints
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const ruta = path.join(__dirname, 'constraints.sql')
  const contenido = fs.readFileSync(ruta, 'utf8')

  const sentencias = contenido
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  let aplicadas = 0
  for (const sentencia of sentencias) {
    try {
      await prisma.$executeRawUnsafe(sentencia)
      aplicadas++
    } catch (error) {
      console.error('\nFallo la sentencia:\n' + sentencia + '\n')
      throw error
    }
  }

  console.log(`Reglas de integridad aplicadas: ${aplicadas} sentencias.`)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
