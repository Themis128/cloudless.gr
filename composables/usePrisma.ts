import { PrismaClient } from '../generated/prisma'

// Create a singleton Prisma client instance
let prisma: PrismaClient

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  // In development, use a global variable to prevent multiple instances
  if (!(global as any).prisma) {
    (global as any).prisma = new PrismaClient()
  }
  prisma = (global as any).prisma
}

export const usePrisma = () => {
  return prisma
}

// Export a simplified database interface
export const useDatabase = () => {
  return {
    // Raw Prisma client for all operations
    prisma,
    
    // Basic CRUD operations for common models
    profile: prisma.profile,
    project: prisma.project,
    bot: prisma.bot,
    pipeline: prisma.pipeline,
    trainingSession: prisma.trainingSession,
    deployment: prisma.deployment,
    analyticsPipeline: prisma.analyticsPipeline,
    
    // Helper methods
    async connect() {
      await prisma.$connect()
    },
    
    async disconnect() {
      await prisma.$disconnect()
    },
    
    async healthCheck() {
      try {
        await prisma.$queryRaw`SELECT 1`
        return { status: 'healthy', connected: true }
      } catch (error: any) {
        return { status: 'unhealthy', connected: false, error: error?.message || 'Unknown error' }
      }
    }
  }
} 