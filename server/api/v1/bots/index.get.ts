// API v1 Bots - List all bots
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
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const status = query.status as string
    const type = query.type as string
    const search = query.search as string

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

    // Build query
    let queryBuilder = supabase
      .from('bots')
      .select('*', { count: 'exact' })
      .eq('user_id', decoded.userId)

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status)
    }

    if (type) {
      queryBuilder = queryBuilder.eq('type', type)
    }

    if (search) {
      queryBuilder = queryBuilder.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Apply pagination
    const offset = (page - 1) * limit
    queryBuilder = queryBuilder.range(offset, offset + limit - 1)

    // Execute query
    const { data: bots, error, count } = await queryBuilder

    if (error) {
      console.error('Database error:', error)
      event.node.res.statusCode = 500
      return {
        success: false,
        error: 'Failed to fetch bots',
        code: 'DATABASE_ERROR'
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    return {
      success: true,
      data: {
        bots: bots || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext,
          hasPrev
        },
        filters: {
          status: status || null,
          type: type || null,
          search: search || null
        }
      },
      message: 'Bots retrieved successfully'
    }

  } catch (error) {
    console.error('List bots error:', error)
    event.node.res.statusCode = 500
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  }
}) 