import { defineEventHandler, getQuery, readBody } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

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
    console.error('LLM Datasets API error:', error)
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
    // Get single dataset
    const dataset = await prisma.dataset.findUnique({
      where: { id: String(id) }
    })

    if (!dataset) {
      throw createError({
        statusCode: 404,
        message: 'Dataset not found'
      })
    }

    return {
      success: true,
      data: dataset,
      message: 'Dataset retrieved successfully'
    }
  } else {
    // Get all datasets
    const datasets = await prisma.dataset.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      success: true,
      data: datasets,
      message: 'Datasets retrieved successfully'
    }
  }
}

async function handlePost(event: any, prisma: any) {
  const body = await readBody(event)
  
  // Validate required fields
  if (!body.name || !body.type || !body.format) {
    throw createError({
      statusCode: 400,
      message: 'Name, type, and format are required'
    })
  }

  const dataset = await prisma.dataset.create({
    data: {
      name: body.name,
      description: body.description || '',
      type: body.type,
      size: body.size || 0,
      format: body.format,
      status: body.status || 'uploading'
    }
  })

  return {
    success: true,
    data: dataset,
    message: 'Dataset created successfully'
  }
} 