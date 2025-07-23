import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bot ID is required'
      })
    }

    const botId = parseInt(id)
    if (isNaN(botId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid bot ID format'
      })
    }

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
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

    if (!bot) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bot not found'
      })
    }

    return {
      success: true,
      data: bot
    }
  } catch (error: any) {
    console.error('Error fetching bot:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 