import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate required fields
    const { name, description, config, status } = body
    
    if (!name || !config || !status) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, config, status'
      })
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be a non-empty string'
      })
    }

    if (typeof config !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Config must be a string'
      })
    }

    // Create the bot
    const bot = await prisma.bot.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        config: config,
        status: status,
        userId: 1 // Default user ID - in a real app, this would come from authentication
      }
    })

    return {
      success: true,
      data: bot
    }
  } catch (error: any) {
    console.error('Error creating bot:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 