import { defineEventHandler, getQuery, createError } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pagination parameters'
      })
    }

    // For now, we'll return a simple response since we don't have profile-specific methods
    // In a real implementation, you would have a getUsers method in databaseService
    const users = await databaseService.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const total = await databaseService.prisma.user.count()

    return {
      success: true,
      data: {
        items: users,
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      message: 'User profiles retrieved successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve user profiles',
      data: { error: error.message }
    })
  }
})