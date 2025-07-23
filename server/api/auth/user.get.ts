import { createError, defineEventHandler, getHeader } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async event => {
  try {
    // Get authorization header
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader) {
      return {
        data: {
          user: null
        }
      }
    }

    // Extract token from header (assuming Bearer token)
    const token = authHeader.replace('Bearer ', '')
    
    // For now, we'll return a mock user since we need to implement JWT verification
    // In a real implementation, you would verify the JWT token and get the user ID
    // Then fetch the user from the database using Prisma
    
    // Mock user data - replace with actual JWT verification
    const mockUser = {
      id: '1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'USER',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return {
      data: {
        user: mockUser
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error while fetching user',
    })
  }
}) 