import { PrismaClient } from '@prisma/client'

// Use a module-scoped variable to ensure a singleton instance per server process
let prisma: PrismaClient | undefined

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })

    // Handle graceful shutdown
    process.on('beforeExit', async () => {
      await prisma?.$disconnect()
    })

    process.on('SIGINT', async () => {
      await prisma?.$disconnect()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      await prisma?.$disconnect()
      process.exit(0)
    })
  }
  return prisma
}

// Export a default instance
export default getPrismaClient()

// Export the PrismaClient type for type safety
export type { PrismaClient }
