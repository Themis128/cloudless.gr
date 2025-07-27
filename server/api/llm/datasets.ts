import { defineEventHandler, getMethod, getQuery, createError, readMultipartFormData, readBody } from 'h3'
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

  try {
    switch (method) {
      case 'GET':
        return await handleGet(event, prisma)
      case 'POST':
        return await handlePost(event, prisma)
      default:
        throw createError({
          statusCode: 405,
          message: 'Method not allowed',
        })
    }
  } catch (error: any) {
    console.error('LLM Datasets API error:', error)

    // Check if it's a Prisma error about missing table
    if (error.message && error.message.includes('does not exist')) {
      return {
        success: true,
        data: [],
        message: 'Datasets table not yet created',
      }
    }

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
    })
  }
})

async function handleGet(event: any, prisma: any) {
  const query = getQuery(event)
  const { id } = query

  try {
    if (id) {
      // Get single dataset
      const dataset = await prisma.dataset.findUnique({
        where: { id: String(id) },
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
    } else {
      // Get all datasets
      const datasets = await prisma.dataset.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      })

      return {
        success: true,
        data: datasets,
        message: 'Datasets retrieved successfully',
      }
    }
  } catch (error: any) {
    // If table doesn't exist, return empty array
    if (error.message && error.message.includes('does not exist')) {
      return {
        success: true,
        data: [],
        message: 'No datasets available',
      }
    }
    throw error
  }
}

async function handlePost(event: any, prisma: any) {
  const formData = await readMultipartFormData(event)
  let name: string | undefined, description: string | undefined, type: string | undefined, format: string | undefined, file: any

  if (formData) {
    // Multipart form data
    name = formData.find(field => field.name === 'name')?.data?.toString()
    description =
      formData.find(field => field.name === 'description')?.data?.toString() ||
      ''
    type = formData.find(field => field.name === 'type')?.data?.toString()
    format = formData.find(field => field.name === 'format')?.data?.toString()
    file = formData.find(field => field.name === 'file')
  } else {
    // Try regular form data
    try {
      const body = await readBody(event)
      name = body.name
      description = body.description || ''
      type = body.type
      format = body.format
      file = null
    } catch {
      throw createError({
        statusCode: 400,
        message: 'Form data is required',
      })
    }
  }

  // Validate required fields
  if (!name || !type || !format) {
    throw createError({
      statusCode: 400,
      message: 'Name, type, and format are required',
    })
  }

  try {
    let filePath = null
    let size = 0

    // Handle file upload if provided
    if (file && file.data) {
      const { writeFile, mkdir } = await import('fs/promises')
      const { join } = await import('path')

      // Create uploads directory if it doesn't exist
      const uploadsDir = join(process.cwd(), 'uploads', 'datasets')
      await mkdir(uploadsDir, { recursive: true })

      // Generate unique filename
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.filename || 'dataset'}`
      filePath = fileName

      // Save file
      await writeFile(join(uploadsDir, fileName), file.data)
      size = file.data.length
    }

    const dataset = await prisma.dataset.create({
      data: {
        name,
        description,
        type,
        size,
        format,
        filePath,
        status: 'uploading',
      },
    })

    return {
      success: true,
      data: dataset,
      message: 'Dataset created successfully',
    }
  } catch (error: any) {
    // If table doesn't exist, return error
    if (error.message && error.message.includes('does not exist')) {
      throw createError({
        statusCode: 503,
        message:
          'Dataset service not available - database schema needs to be updated',
      })
    }
    throw error
  }
}
