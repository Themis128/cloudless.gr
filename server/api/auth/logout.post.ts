import { defineEventHandler, deleteCookie } from 'h3'

export default defineEventHandler(async (event) => {
  // Clear the auth cookie
  deleteCookie(event, 'auth-token')
  
  return {
    success: true,
    message: 'Logged out successfully'
  }
}) 