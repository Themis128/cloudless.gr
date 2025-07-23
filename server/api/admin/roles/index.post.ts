import { defineEventHandler, readBody, createError } from 'h3'
import { rbacService } from '~/server/utils/rbac-service'
import { requireUserManagement } from '~/server/middleware/rbac'

export default defineEventHandler(async (event) => {
  // Apply RBAC middleware
  await requireUserManagement()(event)
  
  const body = await readBody(event)
  
  // Validate input
  if (!body.name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Role name is required'
    })
  }
  
  try {
    const roleId = await rbacService.createRole(
      body.name,
      body.description,
      body.permissionIds
    )
    
    if (!roleId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to create role'
      })
    }
    
    return {
      success: true,
      data: { roleId }
    }
  } catch (error) {
    console.error('Create role error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create role'
    })
  }
}) 