import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

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

    const prisma = await getPrismaClient()
    if (!prisma) {
      throw createError({
        statusCode: 500,
        message: 'Database service unavailable'
      })
    }

    // Check if bot exists
    const existingBot = await prisma.bot.findUnique({
      where: { id: String(id) }
    })

    if (!existingBot) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bot not found'
      })
    }

    // Update bot
    const updatedBot = await prisma.bot.update({
      where: { id: String(id) },
      data: {
        name: body.name,
        description: body.description,
        status: body.status,
        config: body.config
      },
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