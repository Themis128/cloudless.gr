import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireUserManagement } from '~/server/middleware/rbac'
import { rbacService } from '~/server/utils/rbac-service'

export default defineEventHandler(async event => {
  // Apply RBAC middleware
  await requireUserManagement()(event)

  const userId = parseInt(getRouterParam(event, 'id') || '0')
  const body = await readBody(event)

  // Validate input
  if (!userId || isNaN(userId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid user ID is required',
    })
  }

  if (!body.roleId || isNaN(body.roleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid role ID is required',
    })
  }

  try {
    const success = await rbacService.assignRole(
      userId,
      body.roleId,
      body.expiresAt ? new Date(body.expiresAt) : undefined
    )

    if (!success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to assign role to user',
      })
    }

    return {
      success: true,
      message: 'Role assigned successfully',
    }
  } catch (error) {
    console.error('Assign role error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to assign role',
    })
  }
})
