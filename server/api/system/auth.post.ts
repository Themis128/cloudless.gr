/**
 * System Authentication API
 * Protected endpoint for system maintenance access
 */

// System credentials (in production, these should be environment variables)
const SYSTEM_CREDENTIALS = {
  username: process.env.SYSTEM_USERNAME || 'sysadmin_cl_2025',
  password: process.env.SYSTEM_PASSWORD || 'CL_Sys_Acc3ss_2025!@#$'
}

export default defineEventHandler(async (event) => {
  try {
    // Only allow POST requests
    if (event.node.req.method !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method not allowed'
      })
    }

    const body = await readBody(event)
    const { username, password } = body

    // Validate input
    if (!username || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Username and password required'
      })
    }

    // Check credentials
    const isValidUsername = username === SYSTEM_CREDENTIALS.username
    const isValidPassword = password === SYSTEM_CREDENTIALS.password

    if (!isValidUsername || !isValidPassword) {
      // Add delay to prevent brute force attacks
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials'
      })
    }

    // Log access attempt (in production, log to secure audit trail)
    console.log(`[SYSTEM ACCESS] Successful authentication at ${new Date().toISOString()}`)

    return {
      success: true,
      message: 'System access granted',
      timestamp: new Date().toISOString()
    }  } catch (error: unknown) {
    // Log failed attempts
    console.log(`[SYSTEM ACCESS] Failed authentication attempt at ${new Date().toISOString()}`)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
