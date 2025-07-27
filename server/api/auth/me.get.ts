import { defineEventHandler, createError } from 'h3'
import { requireAuth } from '~/server/middleware/auth'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Require authentication
  const authUser = await requireAuth(event)
  
  const prisma = getPrismaClient();
  
  // Get full user details from database
  const prisma = getPrismaClient()
  const user = await prisma.user.findUnique({
    where: { id: parseInt(authUser.id) },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  })
  
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }
  
  return {
    success: true,
    data: user
  }
}) 