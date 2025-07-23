import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Pipeline ID is required'
      })
    }

    const pipelineId = parseInt(id)
    if (isNaN(pipelineId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pipeline ID format'
      })
    }

    // Check if pipeline exists
    const existingPipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId }
    })

    if (!existingPipeline) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pipeline not found'
      })
    }

    // Delete the pipeline
    await prisma.pipeline.delete({
      where: { id: pipelineId }
    })

    return {
      success: true,
      message: 'Pipeline deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting pipeline:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 