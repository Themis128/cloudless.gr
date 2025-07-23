import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Model ID is required'
      })
    }

    const modelId = parseInt(id)
    if (isNaN(modelId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid model ID format'
      })
    }

    // Check if model exists
    const existingModel = await prisma.model.findUnique({
      where: { id: modelId }
    })

    if (!existingModel) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Model not found'
      })
    }

    // Delete the model
    await prisma.model.delete({
      where: { id: modelId }
    })

    return {
      success: true,
      message: 'Model deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting model:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 