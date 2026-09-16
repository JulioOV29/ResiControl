import { PrismaClient } from '@prisma/client'

// Singleton: en desarrollo Next.js recarga los modulos en cada cambio y sin
// esto se abririan decenas de conexiones contra Neon hasta agotar el pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
