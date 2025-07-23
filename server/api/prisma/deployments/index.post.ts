import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate required fields
    const { modelId, name, environment, instanceType, replicas, status } = body
    
    if (!modelId || !name || !environment || !instanceType || !replicas || !status) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: modelId, name, environment, instanceType, replicas, status'
      })
    }

    if (typeof modelId !== 'number' || modelId <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Model ID must be a positive number'
      })
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be a non-empty string'
      })
    }

    if (typeof environment !== 'string' || environment.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Environment must be a non-empty string'
      })
    }

    if (typeof instanceType !== 'string' || instanceType.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Instance type must be a non-empty string'
      })
    }

    if (typeof replicas !== 'number' || replicas < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Replicas must be a positive number'
      })
    }

    if (typeof status !== 'string' || status.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Status must be a non-empty string'
      })
    }

    // Check if model exists
    const model = await prisma.model.findUnique({
      where: { id: modelId }
    })

    if (!model) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Model not found'
      })
    }

    // Create the deployment
    const deployment = await prisma.deployment.create({
      data: {
        modelId: modelId,
        name: name.trim(),
        environment: environment.trim(),
        instanceType: instanceType.trim(),
        replicas: replicas,
        status: status,
        userId: 1 // Default user ID - in a real app, this would come from authentication
      }
    })

    return {
      success: true,
      data: deployment
    }
  } catch (error: any) {
    console.error('Error creating deployment:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 