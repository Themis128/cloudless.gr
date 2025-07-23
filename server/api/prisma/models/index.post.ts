import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate required fields
    const { name, type, description, config, status } = body
    
    if (!name || !type || !config || !status) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, type, config, status'
      })
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be a non-empty string'
      })
    }

    if (typeof type !== 'string' || type.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Type must be a non-empty string'
      })
    }

    if (typeof config !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Config must be a string'
      })
    }

    // Create the model
    const model = await prisma.model.create({
      data: {
        name: name.trim(),
        type: type.trim(),
        description: description?.trim() || null,
        config: config,
        status: status,
        userId: 1 // Default user ID - in a real app, this would come from authentication
      }
    })

    return {
      success: true,
      data: model
    }
  } catch (error: any) {
    console.error('Error creating model:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 