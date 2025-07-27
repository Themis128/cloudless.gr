import { defineEventHandler, readBody, createError } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate required fields
    const { botId, name, status } = body
    
    if (!botId || !name || !status) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: botId, name, status'
      })
    }

    const prisma = await getPrismaClient()
    if (!prisma) {
      throw createError({
        statusCode: 500,
        message: 'Database service unavailable'
      })
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be a non-empty string'
      })
    }

    if (typeof status !== 'string' || status.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Status must be a non-empty string'
      })
    }

    // Check if bot exists
    const bot = await prisma.bot.findUnique({
      where: { id: String(botId) }
    })

    if (!bot) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bot not found'
      })
    }

    // Create the deployment
    const deployment = await prisma.botDeployment.create({
      data: {
        botId: String(botId),
        status: status.trim()
      }
    })

    return {
      success: true,
      data: deployment
    }
  } catch (error: any) {
    console.error('Error creating deployment:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 