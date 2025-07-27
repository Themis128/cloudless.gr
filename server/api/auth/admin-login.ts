// API endpoint for admin authentication
import { defineEventHandler, readBody } from 'h3'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

export default defineEventHandler(async (event) => {
  try {
    const { email: _email, password: _password } = await readBody(event)
    
    // For now, return a mock response
    // In a real implementation, you would validate credentials against the database
    return {
      success: true,
      message: 'Admin login successful',
      token: 'mock-admin-token',
      user: {
        id: 1,
        email: 'admin@example.com',
        role: 'admin'
      }
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body'
    })
  }
})
