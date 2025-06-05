import { defineEventHandler, setCookie } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Clear the admin token cookie
    setCookie(event, 'admin-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Immediately expire the cookie
      path: '/'
    })

    return {
      success: true,
      message: 'Logged out successfully'
    }
  } catch (error) {
    console.error('Logout error:', error)
    return {
      success: false,
      message: 'An error occurred during logout'
    }
  }
})
