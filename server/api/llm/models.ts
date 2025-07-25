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
    console.error('LLM Models API error:', error)
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
    // Get single model
    const model = await prisma.llmModel.findUnique({
      where: { id: String(id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!model) {
      throw createError({
        statusCode: 404,
        message: 'Model not found'
      })
    }

    return {
      success: true,
      data: model,
      message: 'Model retrieved successfully'
    }
  } else {
    // Get all models
    const models = await prisma.llmModel.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      success: true,
      data: models,
      message: 'Models retrieved successfully'
    }
  }
}

async function handlePost(event: any, prisma: any) {
  const body = await readBody(event)
  
  // Validate required fields
  if (!body.name || !body.type) {
    throw createError({
      statusCode: 400,
      message: 'Name and type are required'
    })
  }

  // Get user from session (you'll need to implement authentication)
  const userId = '1' // Placeholder - replace with actual user ID from session

  const model = await prisma.llmModel.create({
    data: {
      name: body.name,
      description: body.description || '',
      type: body.type,
      status: body.status || 'draft',
      framework: body.framework,
      version: body.version,
      config: body.config || {},
      metrics: body.metrics || {},
      userId: userId,
      projectId: body.projectId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  return {
    success: true,
    data: model,
    message: 'Model created successfully'
  }
} 