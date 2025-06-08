// server/api/auth/logout.post.ts

import { setCookie, createError } from 'h3'
import { logger } from '~/utils/logger'

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  try {
    logger.info('🔒 Logout endpoint hit')

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax' as const,
      maxAge: 0 // expire immediately
    }

    // Clear cookies by setting them with empty values and maxAge: 0
    setCookie(event, 'sb-access-token', '', cookieOptions)
    setCookie(event, 'sb-refresh-token', '', cookieOptions)

    logger.info('✅ User logged out (cookies cleared)')

    return {
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    }
  } catch (err: any) {
    logger.error({ err }, '❌ Logout failed')
    throw createError({
      statusCode: 500,
      statusMessage: 'Logout failed',
    })
  }
})
