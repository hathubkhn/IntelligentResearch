import { PrismaClient } from '@/generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// In Node.js (Next.js server), @neondatabase/serverless needs an explicit
// WebSocket constructor. Without it the library falls back to browser-style
// EventSource which breaks in Node.js with "non-101 / ErrorEvent" errors.
neonConfig.webSocketConstructor = ws

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  // PrismaNeon opens one WebSocket per request and reuses it for all queries
  // in that request — no per-query TCP cold-start, no ETIMEDOUT on createMany.
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
