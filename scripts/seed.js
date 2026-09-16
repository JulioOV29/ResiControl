/**
 * Datos iniciales del sistema.
 *
 *   npm run seed
 *
 * Es idempotente: se puede correr varias veces sin duplicar nada.
 * Esta carpeta esta en .gitignore porque contiene credenciales de arranque.
 */
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@resicontrol.com').toLowerCase()
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123*'

const CARGOS = [
  { nombre: 'Oficial', descripcion: 'Ejecuta la actividad principal del frente de trabajo' },
  { nombre: 'Ayudante', descripcion: 'Apoya al oficial en la preparación y el suministro' },
  { nombre: 'Albañil', descripcion: 'Ejecuta trabajos de mampostería y acabados' },
]

const ACTIVIDADES = [
  { nombre: 'Pañete', unidadMedida: 'm2' },
  { nombre: 'Estuco', unidadMedida: 'm2' },
  { nombre: 'Mampostería', unidadMedida: 'm2' },
  { nombre: 'Pintura', unidadMedida: 'm2' },
  { nombre: 'Enchape', unidadMedida: 'm2' },
]

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const admin = await prisma.usuario.upsert({
    where: { email: EMAIL },
    update: { rol: 'ADMIN', activo: true },
    create: {
      nombre: 'Administrador',
      apellido: 'del sistema',
      email: EMAIL,
      passwordHash,
      rol: 'ADMIN',
    },
  })

  for (const cargo of CARGOS) {
    await prisma.cargo.upsert({
      where: { nombre: cargo.nombre },
      update: {},
      create: cargo,
    })
  }

  for (const actividad of ACTIVIDADES) {
    await prisma.actividad.upsert({
      where: { nombre: actividad.nombre },
      update: {},
      create: actividad,
    })
  }

  console.log('')
  console.log('  Datos iniciales cargados')
  console.log('  ------------------------------------------')
  console.log(`  Usuario:    ${admin.email}`)
  console.log(`  Contraseña: ${PASSWORD}`)
  console.log(`  Cargos:     ${CARGOS.length}`)
  console.log(`  Actividades:${ACTIVIDADES.length}`)
  console.log('  ------------------------------------------')
  console.log('  Cambia la contraseña después del primer ingreso.')
  console.log('')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
