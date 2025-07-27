import { defineEventHandler, createError, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const botId = getRouterParam(event, 'id')
    
    if (!botId) {
      throw createError({
        statusCode: 400,
        message: 'Bot ID is required',
      })
    }

    const prisma = event.context.prisma

    // Check if bot exists
    const existingBot = await prisma.bot.findUnique({
      where: { id: botId }
    })

    if (!existingBot) {
      throw createError({
        statusCode: 404,
        message: 'Bot not found',
      })
    }

    // Delete the bot
    await prisma.bot.delete({
      where: { id: botId }
    })

    return {
      success: true,
      message: 'Bot deleted successfully',
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete bot',
    })
  }
}) 