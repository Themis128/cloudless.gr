import { defineEventHandler, createError } from 'h3'
import { rbacService } from '~/server/utils/rbac-service'
import { requireUserManagement } from '~/server/middleware/rbac'

export default defineEventHandler(async (event) => {
  // Apply RBAC middleware
  await requireUserManagement()(event)
  
  try {
    const permissions = await rbacService.getAllPermissions()
    
    return {
      success: true,
      data: permissions
    }
  } catch (error) {
    console.error('Get permissions error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch permissions'
    })
  }
}) 