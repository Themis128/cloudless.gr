#!/usr/bin/env node

// Load environment variables from .env file if it exists
const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

// Load .env file if it exists
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  try {
    const envContent = readFileSync(envPath, 'utf8')
    const envLines = envContent.split('\n')

    for (const line of envLines) {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          process.env[key] = value
        }
      }
    }
  } catch (error) {
    // Error loading .env file - could be logged to a proper logging service
    // console.error('Error loading .env file:', error.message)
  }
}

// Error handling
process.on('uncaughtException', () => {
  // UNCAUGHT EXCEPTION - could be logged to a proper logging service
  // console.error('UNCAUGHT EXCEPTION:', err)
  process.exit(1)
})

process.on('unhandledRejection', () => {
  // UNHANDLED REJECTION - could be logged to a proper logging service
  // console.error('UNHANDLED REJECTION:', reason)
  process.exit(1)
})

const startServer = async () => {
  try {
    // Set default environment variables
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    process.env.NUXT_HOST = process.env.NUXT_HOST || '192.168.0.23'
    process.env.NUXT_PORT = process.env.NUXT_PORT || '3000'
    process.env.NITRO_HOST = process.env.NITRO_HOST || '192.168.0.23'
    process.env.NITRO_PORT = process.env.NITRO_PORT || '3000'

    // Import and start the server
    const serverModule = await import('./.output/server/index.mjs')

    if (serverModule.listener) {
      const { createServer } = await import('node:http')
      const port = parseInt(process.env.NUXT_PORT) || 3000
      const host = process.env.NUXT_HOST || '192.168.0.23'

      const server = createServer(serverModule.listener)

      server.listen(port, host, () => {
        // Server listening - could be logged to a proper logging service
        // console.log(`✅ Server listening on http://${host}:${port}`)
      })

      // Graceful shutdown
      process.on('SIGTERM', () => {
        // SIGTERM received, shutting down gracefully - could be logged to a proper logging service
        // console.log('SIGTERM received, shutting down gracefully...')
        server.close(() => {
          // Server closed - could be logged to a proper logging service
          // console.log('Server closed')
          process.exit(0)
        })
      })

      process.on('SIGINT', () => {
        // SIGINT received, shutting down gracefully - could be logged to a proper logging service
        // console.log('SIGINT received, shutting down gracefully...')
        server.close(() => {
          // Server closed - could be logged to a proper logging service
          // console.log('Server closed')
          process.exit(0)
        })
      })
    } else {
      // No listener function found in server module - could be logged to a proper logging service
      // console.error('No listener function found in server module')
      process.exit(1)
    }
  } catch (error) {
    // Error starting server - could be logged to a proper logging service
    // console.error('Error starting server:', error)
    process.exit(1)
  }
}

startServer()
