import { defineEventHandler, readBody, createError } from 'h3'
import { todoService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { title } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Title is required and must be a non-empty string'
      })
    }

    const todo = await todoService.createTodo({
      title: title.trim()
    })

    return {
      success: true,
      data: todo,
      message: 'Todo created successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create todo',
      data: { error: error.message }
    })
  }
})