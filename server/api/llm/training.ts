import { defineEventHandler, getQuery, readBody } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const prisma = await getPrismaClient()
  if (!prisma) {
    throw createError({
      statusCode: 500,
      message: 'Database service unavailable'
    })
  }

  const method = getMethod(event)

  try {
    switch (method) {
      case 'GET':
        return await handleGet(event, prisma)
      case 'POST':
        return await handlePost(event, prisma)
      default:
        throw createError({
          statusCode: 405,
          message: 'Method not allowed'
        })
    }
  } catch (error: any) {
    console.error('LLM Training API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    })
  }
})

async function handleGet(event: any, prisma: any) {
  const query = getQuery(event)
  const { id } = query

  if (id) {
    // Get single training session
    const training = await prisma.trainingSession.findUnique({
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

    if (!training) {
      throw createError({
        statusCode: 404,
        message: 'Training session not found'
      })
    }

    return {
      success: true,
      data: training,
      message: 'Training session retrieved successfully'
    }
  } else {
    // Get all training sessions
    const trainingSessions = await prisma.trainingSession.findMany({
      include: {
        model: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      success: true,
      data: trainingSessions,
      message: 'Training sessions retrieved successfully'
    }
  }
}

async function handlePost(event: any, prisma: any) {
  const body = await readBody(event)
  
  // Validate required fields
  if (!body.name || !body.modelId) {
    throw createError({
      statusCode: 400,
      message: 'Name and modelId are required'
    })
  }

  // Verify model exists
  const model = await prisma.llmModel.findUnique({
    where: { id: body.modelId }
  })

  if (!model) {
    throw createError({
      statusCode: 404,
      message: 'Model not found'
    })
  }

  const trainingSession = await prisma.trainingSession.create({
    data: {
      name: body.name,
      modelId: body.modelId,
      status: body.status || 'pending',
      progress: body.progress || 0,
      config: body.config || {
        epochs: 10,
        batchSize: 32,
        learningRate: 0.001,
        optimizer: 'adam',
        dataset: 'default'
      },
      logs: body.logs || [],
      metrics: body.metrics || {},
      startedAt: body.startedAt ? new Date(body.startedAt) : null,
      completedAt: body.completedAt ? new Date(body.completedAt) : null
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

  // Update model status to training
  await prisma.llmModel.update({
    where: { id: body.modelId },
    data: { status: 'training' }
  })

  return {
    success: true,
    data: trainingSession,
    message: 'Training session created successfully'
  }
} 