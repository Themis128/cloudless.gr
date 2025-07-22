import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  // Only apply to Prisma API routes
  if (!event.node.req.url?.startsWith('/api/prisma')) {
    return
  }

  // Add Prisma client to event context for easy access
  event.context.prisma = prisma

  // Handle graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, disconnecting Prisma...')
      await prisma.$disconnect()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, disconnecting Prisma...')
      await prisma.$disconnect()
      process.exit(0)
    })
  }
})