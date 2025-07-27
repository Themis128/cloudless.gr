// server/api/models.ts
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async event => {
  try {
    // Mock models data - in a real app, this would come from your database
    const modelsData = [
      {
        id: 1,
        name: 'Text Classification Model',
        description:
          'Advanced text classification model for sentiment analysis',
        status: 'active',
        type: 'classification',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20'),
      },
      {
        id: 2,
        name: 'Image Recognition Model',
        description: 'Computer vision model for object detection',
        status: 'training',
        type: 'vision',
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-18'),
      },
      {
        id: 3,
        name: 'Language Model',
        description: 'Large language model for text generation',
        status: 'deployed',
        type: 'generation',
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-15'),
      },
    ]

    return {
      success: true,
      data: modelsData,
      message: 'Models data retrieved successfully',
    }
  } catch (error: any) {
    console.error('Error fetching models data:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch models data',
    })
  }
})
