import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const prisma = await getPrismaClient()
  if (!prisma) {
    throw createError({
      statusCode: 500,
      message: 'Database service unavailable'
    })
  }

  try {
    const id = getRouterParam(event, 'id')
    
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Training session ID is required'
      })
    }

    // Find the training session
    const trainingSession = await prisma.modelTraining.findUnique({
      where: { id: String(id) },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    if (!trainingSession) {
      throw createError({
        statusCode: 404,
        message: 'Training session not found'
      })
    }

    if (trainingSession.status !== 'running') {
      throw createError({
        statusCode: 400,
        message: 'Training session is not running'
      })
    }

    // Update training session status
    const updatedTrainingSession = await prisma.modelTraining.update({
      where: { id: String(id) },
      data: {
        status: 'stopped'
      },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    // Update model status back to ready
    await prisma.model.update({
      where: { id: trainingSession.modelId },
      data: { status: 'ready' }
    })

    return {
      success: true,
      data: updatedTrainingSession,
      message: 'Training session stopped successfully'
    }
  } catch (error: any) {
    console.error('Stop training API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    })
  }
}) 