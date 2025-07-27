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
        message: 'Deployment ID is required'
      })
    }

    // Find the deployment
    const deployment = await prisma.botDeployment.findUnique({
      where: { id: String(id) },
      include: {
        bot: {
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

    if (deployment.status !== 'active') {
      throw createError({
        statusCode: 400,
        message: 'Deployment is not active'
      })
    }

    // Update deployment status
    const updatedDeployment = await prisma.botDeployment.update({
      where: { id: String(id) },
      data: {
        status: 'inactive'
      },
      include: {
        bot: {
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
      message: 'Deployment stopped successfully'
    }
  } catch (error: any) {
    console.error('Stop deployment API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    })
  }
}) 