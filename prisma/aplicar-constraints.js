/**
 * Aplica las reglas de integridad de prisma/constraints.sql sobre la base de
 * datos. Correr siempre despues de "npx prisma db push", porque db push
 * reconstruye las tablas y puede borrar restricciones creadas a mano.
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
