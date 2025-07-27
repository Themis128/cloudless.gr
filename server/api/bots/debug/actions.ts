import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async event => {
  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    })
  }

  try {
    const body = await readBody(event)

    // Log the bot action for debugging purposes
    console.log('Bot Debug Action:', {
      timestamp: new Date().toISOString(),
      action: body.action,
      botId: body.botId,
      data: body.data,
    })

    // Return success response
    return {
      success: true,
      message: 'Bot action logged successfully',
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error logging bot action:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})
