import { defineEventHandler, getQuery, readBody } from 'h3'
import { getPrismaClient } from '~/server/utils/database'

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
    console.error('LLM Deployments API error:', error)
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
    // Get single deployment
    const deployment = await prisma.deployment.findUnique({
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

    if (!deployment) {
      throw createError({
        statusCode: 404,
        message: 'Deployment not found'
      })
    }

    return {
      success: true,
      data: deployment,
      message: 'Deployment retrieved successfully'
    }
  } else {
    // Get all deployments
    const deployments = await prisma.deployment.findMany({
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
      data: deployments,
      message: 'Deployments retrieved successfully'
    }
  }
}

async function handlePost(event: any, prisma: any) {
  const body = await readBody(event)
  
  // Validate required fields
  if (!body.name || !body.modelId || !body.endpoint) {
    throw createError({
      statusCode: 400,
      message: 'Name, modelId, and endpoint are required'
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

  const deployment = await prisma.deployment.create({
    data: {
      name: body.name,
      modelId: body.modelId,
      status: body.status || 'deploying',
      endpoint: body.endpoint,
      config: body.config || {
        replicas: 1,
        resources: {
          cpu: '500m',
          memory: '1Gi'
        },
        scaling: {
          minReplicas: 1,
          maxReplicas: 5
        }
      },
      metrics: body.metrics || {}
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

  // Update model status to deployed
  await prisma.llmModel.update({
    where: { id: body.modelId },
    data: { status: 'deployed' }
  })

  return {
    success: true,
    data: deployment,
    message: 'Deployment created successfully'
  }
} 