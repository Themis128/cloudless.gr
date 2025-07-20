// API v1 Bots - Create new bot
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
    const { name, type, description, configuration, modelId, projectId } = body

    // Validate required fields
    if (!name || !type) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Missing required fields: name and type',
        code: 'MISSING_FIELDS'
      }
    }

    // Validate bot type
    const validTypes = ['customer-support', 'developer-assistant', 'data-analyst', 'content-writer', 'custom']
    if (!validTypes.includes(type)) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Invalid bot type',
        code: 'INVALID_TYPE',
        validTypes
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

    // Check if bot name already exists for this user
    const { data: existingBot } = await supabase
      .from('bots')
      .select('id')
      .eq('user_id', decoded.userId)
      .eq('name', name)
      .single()

    if (existingBot) {
      event.node.res.statusCode = 409
      return {
        success: false,
        error: 'Bot with this name already exists',
        code: 'BOT_EXISTS'
      }
    }

    // Create bot record
    const botData = {
      user_id: decoded.userId,
      name,
      type,
      description: description || '',
      configuration: configuration || {},
      model_id: modelId || null,
      project_id: projectId || null,
      status: 'draft',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: bot, error } = await supabase
      .from('bots')
      .insert(botData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      event.node.res.statusCode = 500
      return {
        success: false,
        error: 'Failed to create bot',
        code: 'DATABASE_ERROR'
      }
    }

    return {
      success: true,
      data: {
        bot
      },
      message: 'Bot created successfully'
    }

  } catch (error) {
    console.error('Create bot error:', error)
    event.node.res.statusCode = 500
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  }
}) 