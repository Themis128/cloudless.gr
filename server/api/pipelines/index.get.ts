import { createError, defineEventHandler } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  try {
    const prisma = await getPrismaClient()
    if (!prisma) {
      throw createError({
        statusCode: 500,
        message: 'Database service unavailable'
      })
    }

    const pipelines = await prisma.pipeline.findMany({
      include: {
        runs: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      success: true,
      data: pipelines,
      message: 'Pipelines retrieved successfully',
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to retrieve pipelines',
    })
  }
})
