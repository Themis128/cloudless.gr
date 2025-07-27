// server/api/pipelines.ts
import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async event => {
  try {
    // Mock pipelines data - in a real app, this would come from your database
    const pipelinesData = [
      {
        id: 1,
        name: 'Data Processing Pipeline',
        description: 'End-to-end data processing workflow',
        status: 'active',
        config: JSON.stringify({
          steps: [
            { name: 'Data Ingestion', type: 'input' },
            { name: 'Data Cleaning', type: 'transform' },
            { name: 'Data Analysis', type: 'analysis' },
          ],
        }),
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20'),
      },
      {
        id: 2,
        name: 'ML Training Pipeline',
        description: 'Machine learning model training workflow',
        status: 'running',
        config: JSON.stringify({
          steps: [
            { name: 'Data Preparation', type: 'preprocess' },
            { name: 'Model Training', type: 'train' },
            { name: 'Model Evaluation', type: 'evaluate' },
          ],
        }),
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-18'),
      },
      {
        id: 3,
        name: 'Inference Pipeline',
        description: 'Real-time inference processing',
        status: 'deployed',
        config: JSON.stringify({
          steps: [
            { name: 'Input Validation', type: 'validate' },
            { name: 'Model Inference', type: 'inference' },
            { name: 'Output Formatting', type: 'format' },
          ],
        }),
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-15'),
      },
    ]

    return {
      success: true,
      data: pipelinesData,
      message: 'Pipelines data retrieved successfully',
    }
  } catch (error: any) {
    console.error('Error fetching pipelines data:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch pipelines data',
    })
  }
})
