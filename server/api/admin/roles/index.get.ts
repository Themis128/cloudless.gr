import { defineEventHandler, createError } from 'h3'
import { rbacService } from '~/server/utils/rbac-service'
import { requireUserManagement } from '~/server/middleware/rbac'

export default defineEventHandler(async (event) => {
  // Apply RBAC middleware
  await requireUserManagement()(event)
  
  try {
    const roles = await rbacService.getAllRoles()
    
    return {
      success: true,
      data: roles
    }
  } catch (error) {
    console.error('Get roles error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch roles'
    })
  }
}) 