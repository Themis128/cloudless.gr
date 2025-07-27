import { createError, defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async event => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pagination parameters',
      })
    }

    const skip = (page - 1) * limit

    // Get todos with pagination
    const [todos, total] = await Promise.all([
      prisma.todo.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.todo.count(),
    ])

    return {
      success: true,
      data: todos,
      total,
      page,
      pages: Math.ceil(total / limit),
    }
  } catch (error: any) {
    console.error('Error fetching todos:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    })
  }
})
