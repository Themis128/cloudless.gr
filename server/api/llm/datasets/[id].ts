import { defineEventHandler, getMethod, readBody } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  const prisma = await getPrismaClient()
  if (!prisma) {
    throw createError({
      statusCode: 500,
      message: 'Database service unavailable',
    })
  }

  const method = getMethod(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Dataset ID is required',
    })
  }

  try {
    switch (method) {
      case 'GET':
        return await handleGet(event, prisma, id)
      case 'PUT':
        return await handlePut(event, prisma, id)
      case 'DELETE':
        return await handleDelete(event, prisma, id)
      default:
        throw createError({
          statusCode: 405,
          message: 'Method not allowed',
        })
    }
  } catch (error: any) {
    console.error('LLM Dataset API error:', error)

    // Check if it's a Prisma error about missing table
    if (error.message && error.message.includes('does not exist')) {
      throw createError({
        statusCode: 503,
        message:
          'Dataset service not available - database schema needs to be updated',
      })
    }

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
    })
  }
})

async function handleGet(event: any, prisma: any, id: string) {
  const dataset = await prisma.dataset.findUnique({
    where: { id },
  })

  if (!dataset) {
    throw createError({
      statusCode: 404,
      message: 'Dataset not found',
    })
  }

  return {
    success: true,
    data: dataset,
    message: 'Dataset retrieved successfully',
  }
}

async function handlePut(event: any, prisma: any, id: string) {
  const body = await readBody(event)

  try {
    const dataset = await prisma.dataset.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        type: body.type,
        status: body.status,
        size: body.size,
        format: body.format,
        samples: body.samples,
        filePath: body.filePath,
      },
    })

    return {
      success: true,
      data: dataset,
      message: 'Dataset updated successfully',
    }
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        message: 'Dataset not found',
      })
    }
    throw error
  }
}

async function handleDelete(event: any, prisma: any, id: string) {
  try {
    const dataset = await prisma.dataset.delete({
      where: { id },
    })

    return {
      success: true,
      data: dataset,
      message: 'Dataset deleted successfully',
    }
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        message: 'Dataset not found',
      })
    }
    throw error
  }
}
