// API v1 Bots - Chat with bot
import { defineEventHandler, readBody, getHeader, getRouterParam } from 'h3'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  try {
    // Get bot ID from URL
    const botId = getRouterParam(event, 'id')
    if (!botId) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Bot ID is required',
        code: 'MISSING_BOT_ID'
      }
    }

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
    const { message, context, sessionId } = body

    // Validate required fields
    if (!message) {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Message is required',
        code: 'MISSING_MESSAGE'
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

    // Get bot details
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', decoded.userId)
      .single()

    if (botError || !bot) {
      event.node.res.statusCode = 404
      return {
        success: false,
        error: 'Bot not found',
        code: 'BOT_NOT_FOUND'
      }
    }

    // Check if bot is active
    if (bot.status !== 'active') {
      event.node.res.statusCode = 400
      return {
        success: false,
        error: 'Bot is not active',
        code: 'BOT_INACTIVE',
        botStatus: bot.status
      }
    }

    // Get bot model if configured
    let model = null
    if (bot.model_id) {
      const { data: modelData } = await supabase
        .from('models')
        .select('*')
        .eq('id', bot.model_id)
        .single()
      model = modelData
    }

    // Generate bot response (simplified - you can integrate with actual AI services)
    const response = await generateBotResponse(bot, message, context, model)

    // Store conversation in database
    const conversationData = {
      bot_id: botId,
      user_id: decoded.userId,
      session_id: sessionId || `session_${Date.now()}`,
      user_message: message,
      bot_response: response,
      context: context || {},
      created_at: new Date().toISOString()
    }

    const { error: conversationError } = await supabase
      .from('conversations')
      .insert(conversationData)

    if (conversationError) {
      // console.error('Failed to store conversation:', conversationError)
      // Don't fail the request if conversation storage fails
    }

    // Update bot usage statistics
    await updateBotUsage(botId, supabase)

    return {
      success: true,
      data: {
        response,
        sessionId: conversationData.session_id,
        bot: {
          id: bot.id,
          name: bot.name,
          type: bot.type
        },
        timestamp: new Date().toISOString()
      },
      message: 'Chat response generated successfully'
    }

  } catch (error) {
    // console.error('Chat error:', error)
    event.node.res.statusCode = 500
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  }
})

// Helper function to generate bot response
async function generateBotResponse(bot: any, message: string, context: any, model: any) {
  // This is a simplified response generator
  // In a real implementation, you would integrate with OpenAI, Anthropic, or other AI services
  
  const responses = {
    'customer-support': [
      "Thank you for contacting our support team. I'm here to help you with any questions or issues you may have.",
      "I understand your concern. Let me assist you with that right away.",
      "I'm sorry to hear about this issue. Let me help you resolve it."
    ],
    'developer-assistant': [
      "I can help you with your development questions. What specific programming challenge are you facing?",
      "Let me analyze your code and provide some suggestions.",
      "I can help you debug this issue. Can you share more details about the error?"
    ],
    'data-analyst': [
      "I can help you analyze your data. What insights are you looking for?",
      "Let me process your data and provide some analytical insights.",
      "I can help you create visualizations and reports for your data."
    ],
    'content-writer': [
      "I can help you create engaging content. What type of content are you looking to write?",
      "Let me help you craft compelling copy for your audience.",
      "I can assist you with content strategy and writing."
    ],
    'custom': [
      "I'm here to help you with your custom requirements.",
      "Let me assist you with your specific needs.",
      "I can help you with your personalized tasks."
    ]
  }

  const botResponses = responses[bot.type as keyof typeof responses] || responses.custom
  const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)]
  
  return `${randomResponse} Your message: "${message}"`
}

// Helper function to update bot usage statistics
async function updateBotUsage(botId: string, supabase: any) {
  try {
    // Get current usage
    const { data: usage } = await supabase
      .from('bot_usage')
      .select('*')
      .eq('bot_id', botId)
      .single()

    const today = new Date().toISOString().split('T')[0]
    
    if (usage) {
      // Update existing usage
      await supabase
        .from('bot_usage')
        .update({
          message_count: (usage.message_count || 0) + 1,
          last_used: new Date().toISOString()
        })
        .eq('bot_id', botId)
    } else {
      // Create new usage record
      await supabase
        .from('bot_usage')
        .insert({
          bot_id: botId,
          message_count: 1,
          last_used: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
    }
  } catch (error) {
    // console.error('Failed to update bot usage:', error)
  }
} 