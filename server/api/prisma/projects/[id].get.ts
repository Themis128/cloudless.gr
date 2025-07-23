import { defineEventHandler, getRouterParam, createError } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Project ID is required'
      })
    }

    const projectId = parseInt(id)
    if (isNaN(projectId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid project ID format'
      })
    }

    const project = await databaseService.getProjectById(projectId)

    if (!project) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Project not found'
      })
    }

    return {
      success: true,
      data: project,
      message: 'Project retrieved successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve project',
      data: { error: error.message }
    })
  }
})