import { defineEventHandler, getRouterParam, createError } from 'h3'
import { databaseService } from '~/lib/database'

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

    // Check if bot exists
    const existingBot = await databaseService.prisma.bot.findUnique({
      where: { id: botId }
    })

    if (!existingBot) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bot not found'
      })
    }

    // Delete bot
    await databaseService.prisma.bot.delete({
      where: { id: botId }
    })

    return {
      success: true,
      data: true,
      message: 'Bot deleted successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete bot',
      data: { error: error.message }
    })
  }
}) 