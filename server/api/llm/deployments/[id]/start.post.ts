import { defineEventHandler, getRouterParam } from 'h3'
import { getPrismaClient } from '~/server/utils/database'

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
        message: 'Deployment ID is required'
      })
    }

    // Find the deployment
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

    if (deployment.status === 'active') {
      throw createError({
        statusCode: 400,
        message: 'Deployment is already active'
      })
    }

    // Update deployment status
    const updatedDeployment = await prisma.deployment.update({
      where: { id: String(id) },
      data: {
        status: 'active',
        metrics: {
          requestsPerSecond: 0,
          averageResponseTime: 0,
          errorRate: 0,
          cpuUsage: 0,
          memoryUsage: 0
        }
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

    return {
      success: true,
      data: updatedDeployment,
      message: 'Deployment started successfully'
    }
  } catch (error: any) {
    console.error('Start deployment API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    })
  }
}) 