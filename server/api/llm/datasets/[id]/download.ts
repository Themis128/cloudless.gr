import { existsSync, readFileSync } from 'fs'
import { defineEventHandler, getMethod } from 'h3'
import { join } from 'path'
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

  if (method !== 'GET') {
    throw createError({
      statusCode: 405,
      message: 'Method not allowed',
    })
  }

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Dataset ID is required',
    })
  }

  try {
    // Get dataset from database
    const dataset = await prisma.dataset.findUnique({
      where: { id },
    })

    if (!dataset) {
      throw createError({
        statusCode: 404,
        message: 'Dataset not found',
      })
    }

    if (!dataset.filePath) {
      throw createError({
        statusCode: 404,
        message: 'Dataset file not found',
      })
    }

    // Check if file exists
    const filePath = join(
      process.cwd(),
      'uploads',
      'datasets',
      dataset.filePath
    )

    if (!existsSync(filePath)) {
      throw createError({
        statusCode: 404,
        message: 'Dataset file not found on disk',
      })
    }

    // Read file
    const fileBuffer = readFileSync(filePath)

    // Set response headers
    setHeader(event, 'Content-Type', 'application/octet-stream')
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${dataset.name}.${dataset.format}"`
    )
    setHeader(event, 'Content-Length', fileBuffer.length)

    return fileBuffer
  } catch (error: any) {
    console.error('Dataset download error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to download dataset',
    })
  }
})
