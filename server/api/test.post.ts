import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    console.log('Test endpoint body:', body)
    
    return {
      success: true,
      message: 'Test endpoint working',
      receivedBody: body
    }
  } catch (error) {
    console.error('Test endpoint error:', error)
    throw createError({
      statusCode: 400,
      statusMessage: 'Error reading body'
    })
  }
}) 