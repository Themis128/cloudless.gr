// API v1 Analytics - Dashboard metrics
import { defineEventHandler, getQuery, getHeader } from 'h3'
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

    // Get query parameters
    const query = getQuery(event)
    const period = query.period as string || '7d' // 7d, 30d, 90d, 1y
    const projectId = query.projectId as string

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

    // Calculate date range
    const now = new Date()
    const startDate = new Date()
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setDate(now.getDate() - 7)
    }

    // Build base query filter
    let baseFilter = supabase.from('bots').select('*').eq('user_id', decoded.userId)
    if (projectId) {
      baseFilter = baseFilter.eq('project_id', projectId)
    }

    // Get bot statistics
    const { data: bots, error: botsError } = await baseFilter

    if (botsError) {
      console.error('Bots query error:', botsError)
    }

    // Get conversation statistics
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', decoded.userId)
      .gte('created_at', startDate.toISOString())

    if (conversationsError) {
      console.error('Conversations query error:', conversationsError)
    }

    // Get model statistics
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .eq('user_id', decoded.userId)

    if (modelsError) {
      console.error('Models query error:', modelsError)
    }

    // Get pipeline statistics
    const { data: pipelines, error: pipelinesError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('user_id', decoded.userId)

    if (pipelinesError) {
      console.error('Pipelines query error:', pipelinesError)
    }

    // Calculate metrics
    const metrics = {
      bots: {
        total: bots?.length || 0,
        active: bots?.filter(bot => bot.status === 'active').length || 0,
        draft: bots?.filter(bot => bot.status === 'draft').length || 0,
        byType: bots?.reduce((acc, bot) => {
          acc[bot.type] = (acc[bot.type] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}
      },
      conversations: {
        total: conversations?.length || 0,
        today: conversations?.filter(conv => {
          const convDate = new Date(conv.created_at).toDateString()
          return convDate === now.toDateString()
        }).length || 0,
        thisWeek: conversations?.filter(conv => {
          const convDate = new Date(conv.created_at)
          return convDate >= startDate
        }).length || 0
      },
      models: {
        total: models?.length || 0,
        trained: models?.filter(model => model.status === 'trained').length || 0,
        training: models?.filter(model => model.status === 'training').length || 0
      },
      pipelines: {
        total: pipelines?.length || 0,
        active: pipelines?.filter(pipeline => pipeline.status === 'active').length || 0,
        completed: pipelines?.filter(pipeline => pipeline.status === 'completed').length || 0
      }
    }

    // Calculate usage trends
    const usageTrends = calculateUsageTrends(conversations || [], period)

    // Calculate performance metrics
    const performance = {
      averageResponseTime: 1.2, // Mock data - calculate from actual response times
      uptime: 99.9, // Mock data - calculate from actual uptime
      errorRate: 0.1, // Mock data - calculate from actual errors
      userSatisfaction: 4.5 // Mock data - calculate from actual ratings
    }

    return {
      success: true,
      data: {
        metrics,
        usageTrends,
        performance,
        period,
        projectId: projectId || null,
        timestamp: new Date().toISOString()
      },
      message: 'Dashboard metrics retrieved successfully'
    }

  } catch (error) {
    console.error('Dashboard analytics error:', error)
    event.node.res.statusCode = 500
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  }
})

// Helper function to calculate usage trends
function calculateUsageTrends(conversations: any[], period: string) {
  const trends = {
    daily: [] as any[],
    weekly: [] as any[],
    monthly: [] as any[]
  }

  // Group conversations by date
  const groupedByDate = conversations.reduce((acc, conv) => {
    const date = new Date(conv.created_at).toISOString().split('T')[0]
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Convert to array format
  trends.daily = Object.entries(groupedByDate).map(([date, count]) => ({
    date,
    count
  })).sort((a, b) => a.date.localeCompare(b.date))

  return trends
} 