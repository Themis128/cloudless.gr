import { defineEventHandler, createError } from 'h3'
import { todoService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const todos = await todoService.listTodos()

    return {
      success: true,
      data: todos,
      message: 'Todos retrieved successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve todos',
      data: { error: error.message }
    })
  }
})