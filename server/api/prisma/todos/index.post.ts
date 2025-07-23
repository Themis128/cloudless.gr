import { defineEventHandler, readBody, createError } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // For now, we'll return a mock response since we don't have a Todo model in our schema
    // In a real implementation, you would have a createTodo method in databaseService
    const mockTodo = {
      id: Date.now(),
      title: body.title,
      is_complete: false,
      created_at: new Date().toISOString()
    }

    return {
      success: true,
      data: mockTodo,
      message: 'Todo created successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create todo',
      data: { error: error.message }
    })
  }
})