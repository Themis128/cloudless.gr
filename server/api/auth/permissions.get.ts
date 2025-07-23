import { defineEventHandler, getCookie, createError } from 'h3'
import { authService } from '~/server/utils/auth-service'
import { rbacService } from '~/server/utils/rbac-service'

export default defineEventHandler(async (event) => {
  try {
    // Get token from cookie
    const token = getCookie(event, 'auth-token')
    
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }

    // Verify token and get user
    const user = await authService.verifyToken(token)
    
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid or expired token'
      })
    }

    // Get user permissions
    const permissions = await rbacService.getUserPermissions(parseInt(user.id))
    
    return {
      success: true,
      data: permissions
    }
  } catch (error: any) {
    console.error('Get permissions error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch permissions'
    })
  }
}) 