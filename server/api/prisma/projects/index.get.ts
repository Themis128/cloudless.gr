import { defineEventHandler, getQuery, createError } from 'h3'
import { projectService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const ownerId = query.ownerId as string

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pagination parameters'
      })
    }

    const result = await projectService.listProjects(ownerId, page, limit)

    return {
      success: true,
      data: result,
      message: 'Projects retrieved successfully'
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