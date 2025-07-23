import { defineEventHandler, getCookie, createError } from 'h3'
import { authService } from '~/server/utils/auth-service'
import { rbacService } from '~/server/utils/rbac-service'

export interface RBACOptions {
  resource: string
  action: string
  requireAll?: boolean
  permissions?: Array<{ resource: string; action: string }>
}

// RBAC middleware factory
export function requirePermission(options: RBACOptions) {
  return defineEventHandler(async (event) => {
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

      // Check permissions
      let hasAccess = false

      if (options.permissions) {
        // Check multiple permissions
        if (options.requireAll) {
          hasAccess = await rbacService.hasAllPermissions(parseInt(user.id), options.permissions)
        } else {
          hasAccess = await rbacService.hasAnyPermission(parseInt(user.id), options.permissions)
        }
      } else {
        // Check single permission
        hasAccess = await rbacService.hasPermission(parseInt(user.id), options.resource, options.action)
      }

      if (!hasAccess) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Insufficient permissions'
        })
      }

      // Add user to event context
      event.context.user = user
      event.context.userId = parseInt(user.id)

    } catch (error: any) {
      if (error.statusCode) {
        throw error
      }
      
      throw createError({
        statusCode: 500,
        statusMessage: 'Authorization check failed'
      })
    }
  })
}

// Convenience functions for common permission checks
export const requireAdmin = () => requirePermission({ resource: 'admin', action: 'all' })

export const requireUserManagement = () => requirePermission({ resource: 'admin', action: 'users' })

export const requireBotAccess = (action: 'read' | 'create' | 'update' | 'delete' | 'deploy') => 
  requirePermission({ resource: 'bot', action })

export const requireModelAccess = (action: 'read' | 'create' | 'update' | 'delete' | 'train') => 
  requirePermission({ resource: 'model', action })

export const requirePipelineAccess = (action: 'read' | 'create' | 'update' | 'delete' | 'execute') => 
  requirePermission({ resource: 'pipeline', action })

// Helper function to get user from event context
export function getUserFromEvent(event: any) {
  return event.context.user
}

// Helper function to get user ID from event context
export function getUserIdFromEvent(event: any): number {
  return event.context.userId
}

// Default export for Nitro middleware
export default defineEventHandler(async (event) => {
  // This is a middleware factory, not a direct middleware
  // Individual routes should use the specific middleware functions
  return
}) 