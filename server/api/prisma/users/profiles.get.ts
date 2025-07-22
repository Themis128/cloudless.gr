import { defineEventHandler, getQuery, createError, getHeader } from 'h3'
import { userService } from '~/lib/database'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  try {
    // Optional: Add authentication check
    const authHeader = getHeader(event, 'authorization')
    let currentUserId: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7)
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
        currentUserId = decoded.userId || decoded.sub
      } catch (jwtError) {
        // Token invalid, continue without user context
      }
    }

    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pagination parameters'
      })
    }

    const result = await userService.listProfiles(page, limit)

    // Remove sensitive information from profiles if not admin
    const sanitizedProfiles = result.profiles.map(profile => ({
      id: profile.id,
      username: profile.username,
      first_name: profile.first_name,
      last_name: profile.last_name,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      role: profile.role,
      is_active: profile.is_active,
      created_at: profile.created_at,
      // Only include email for the current user or admin
      email: (currentUserId === profile.id || profile.role === 'admin') ? profile.email : undefined
    }))

    return {
      success: true,
      data: {
        ...result,
        profiles: sanitizedProfiles
      },
      message: 'User profiles retrieved successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve user profiles',
      data: { error: error.message }
    })
  }
})