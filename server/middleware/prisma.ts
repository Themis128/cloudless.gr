import { defineEventHandler } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Only apply to Prisma API routes
  if (!event.node.req.url?.startsWith('/api/prisma')) {
    return
  }

  // Add Prisma client to event context for easy access
  const prisma = await getPrismaClient()
  if (prisma) {
    event.context.prisma = prisma
  }
})