import { createError, defineEventHandler, readBody } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  try {
    const body = await readBody(event)

    // Validate required fields
    if (!body.name) {
      throw createError({
        statusCode: 400,
        message: 'Pipeline name is required',
      })
    }

    if (!body.description) {
      throw createError({
        statusCode: 400,
        message: 'Pipeline description is required',
      })
    }

    if (!body.steps || !Array.isArray(body.steps)) {
      throw createError({
        statusCode: 400,
        message: 'Pipeline steps are required and must be an array',
      })
    }

    // Check pipeline limit
    const prisma = await getPrismaClient()
    if (!prisma) {
      throw createError({
        statusCode: 500,
        message: 'Database service unavailable'
      })
    }

    const existingPipelines = await prisma.pipeline.count({
      where: {
        userId: body.userId || 1, // Default to user 1 for now
      },
    })

    if (existingPipelines >= 50) { // Default limit
      throw createError({
        statusCode: 429,
        message: 'Maximum number of pipelines (50) reached',
      })
    }

    // Create the pipeline
    const pipeline = await prisma.pipeline.create({
      data: {
        name: body.name,
        description: body.description,
        type: body.type || 'data',
        status: body.status || 'draft',
        config: body.config || '{}',
        userId: body.userId || 1,
      },
      include: {
        runs: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return {
      success: true,
      data: pipeline,
      message: 'Pipeline created successfully',
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create pipeline',
    })
  }
})
