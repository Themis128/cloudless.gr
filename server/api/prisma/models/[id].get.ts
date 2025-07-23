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

    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!model) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Model not found'
      })
    }

    return {
      success: true,
      data: model
    }
  } catch (error: any) {
    console.error('Error fetching model:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 