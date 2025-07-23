import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Todo ID is required'
      })
    }

    const todoId = parseInt(id)
    if (isNaN(todoId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid todo ID format'
      })
    }

    // Validate the update data
    const { title, is_complete } = body
    
    if (title !== undefined && typeof title !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Title must be a string'
      })
    }
    
    if (is_complete !== undefined && typeof is_complete !== 'boolean') {
      throw createError({
        statusCode: 400,
        statusMessage: 'is_complete must be a boolean'
      })
    }

    // Check if todo exists
    const existingTodo = await prisma.todo.findUnique({
      where: { id: todoId }
    })

    if (!existingTodo) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Todo not found'
      })
    }

    // Update the todo
    const updatedTodo = await prisma.todo.update({
      where: { id: todoId },
      data: {
        ...(title !== undefined && { title }),
        ...(is_complete !== undefined && { is_complete }),
        updated_at: new Date()
      }
    })

    return {
      success: true,
      data: updatedTodo
    }
  } catch (error: any) {
    console.error('Error updating todo:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 