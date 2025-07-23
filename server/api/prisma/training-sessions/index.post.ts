import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate required fields
    const { name, datasetUrl, epochs, status } = body
    
    if (!name || !datasetUrl || !epochs || !status) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, datasetUrl, epochs, status'
      })
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be a non-empty string'
      })
    }

    if (typeof datasetUrl !== 'string' || datasetUrl.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Dataset URL must be a non-empty string'
      })
    }

    if (typeof epochs !== 'number' || epochs < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Epochs must be a positive number'
      })
    }

    if (typeof status !== 'string' || status.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Status must be a non-empty string'
      })
    }

    // Create the training session
    const trainingSession = await prisma.trainingSession.create({
      data: {
        name: name.trim(),
        datasetUrl: datasetUrl.trim(),
        epochs: epochs,
        status: status,
        userId: 1 // Default user ID - in a real app, this would come from authentication
      }
    })

    return {
      success: true,
      data: trainingSession
    }
  } catch (error: any) {
    console.error('Error creating training session:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 