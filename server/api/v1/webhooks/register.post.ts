// API v1 Webhooks - Register webhook endpoint
import { defineEventHandler, readBody, getHeader } from 'h3'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  try {
    // Get authentication token
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      event.node.res.statusCode = 401
      return {
        success: false,
        error: 'Missing or invalid authorization header',
        code: 'UNAUTHORIZED'
      }
    }

    const token = authHeader.substring(7)
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'

    // Verify JWT token
    let decoded
    try {
      decoded = jwt.verify(token, jwtSecret) as any
    } catch (error) {
      event.node.res.statusCode = 401
      return {
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      }
    }

    // Get request body
    const body = await readBody(event)
    const { url, events, description, secret } = body

    // Validate required fields
    if (!url || !events) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Missing required fields: url and events',
        code: 'MISSING_FIELDS'
      }
    }

    // Validate URL format
    try {
      new URL(url)
    } catch (error) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Invalid URL format',
        code: 'INVALID_URL'
      }
    }

    // Validate events array
    const validEvents = [
      'bot.created',
      'bot.updated',
      'bot.deleted',
      'bot.deployed',
      'conversation.created',
      'model.trained',
      'pipeline.completed',
      'project.created',
      'project.updated'
    ]

    if (!Array.isArray(events) || events.length === 0) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Events must be a non-empty array',
        code: 'INVALID_EVENTS'
      }
    }

    const invalidEvents = events.filter(event => !validEvents.includes(event))
    if (invalidEvents.length > 0) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Invalid events provided',
        code: 'INVALID_EVENTS',
        invalidEvents,
        validEvents
      }
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      event.node.res.statusCode = 500
      return {
        success: false,
        error: 'Database service not configured',
        code: 'SERVICE_UNAVAILABLE'
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Generate webhook secret if not provided
    const webhookSecret = secret || generateWebhookSecret()

    // Create webhook record
    const webhookData = {
      user_id: decoded.userId,
      url,
      events,
      description: description || '',
      secret: webhookSecret,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert(webhookData)
      .select()
      .single()

    if (error) {
      // console.error('Database error:', error)
      event.node.res.statusCode = 500
      return {
        success: false,
        error: 'Failed to register webhook',
        code: 'DATABASE_ERROR'
      }
    }

    // Test webhook endpoint
    try {
      await testWebhookEndpoint(url, {
        event: 'webhook.test',
        data: {
          message: 'Webhook registration test',
          timestamp: new Date().toISOString()
        },
        secret: webhookSecret
      })
    } catch (testError) {
      // console.error('Webhook test failed:', testError)
      // Don't fail registration if test fails
    }

    return {
      success: true,
      data: {
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          status: webhook.status,
          createdAt: webhook.created_at
        },
        secret: webhookSecret // Include secret in response for client to store
      },
      message: 'Webhook registered successfully'
    }

  } catch (error) {
    // console.error('Webhook registration error:', error)
    event.node.res.statusCode = 500
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  }
})

// Helper function to generate webhook secret
function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Helper function to test webhook endpoint
async function testWebhookEndpoint(url: string, payload: any): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': payload.secret,
        'User-Agent': 'Cloudless-Wizard-Webhook/1.0'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    throw new Error(`Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
} 