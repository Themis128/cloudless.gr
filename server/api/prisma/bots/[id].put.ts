import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)

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

    // Update bot
    const updatedBot = await databaseService.prisma.bot.update({
      where: { id: botId },
      data: {
        name: body.name,
        description: body.description,
        status: body.status,
        config: body.config,
        model_id: body.model_id,
        pipeline_id: body.pipeline_id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        model: {
          select: {
            id: true,
            name: true,
            version: true
          }
        },
        pipeline: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    })

    return {
      success: true,
      data: updatedBot,
      message: 'Bot updated successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update bot',
      data: { error: error.message }
    })
  }
}) 