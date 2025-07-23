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

    // Get projects from database
    const projects = await databaseService.prisma.project.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Simple pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedProjects = projects.slice(startIndex, endIndex)

    return {
      success: true,
      data: paginatedProjects,
      total: projects.length,
      page,
      pages: Math.ceil(projects.length / limit)
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve projects',
      data: { error: error.message }
    })
  }
})