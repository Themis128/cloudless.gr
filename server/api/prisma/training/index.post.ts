import { defineEventHandler, readBody } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Create a new training session
    const training = await prisma.trainingSession.create({
      data: {
        modelName: body.modelName,
        datasetPath: body.datasetPath,
        status: 'PENDING',
        userId: body.userId || '1', // Default user ID for now
        parameters: body.parameters || {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      data: training
    }
  } catch (error) {
    console.error('Error creating training session:', error)
    return {
      success: false,
      error: 'Failed to create training session'
    }
  }
})