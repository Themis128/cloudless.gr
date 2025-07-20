import { createClient } from '@supabase/supabase-js'
import { createError, defineEventHandler, getHeader } from 'h3'
import type { Database } from '~/types/database.types'

export default defineEventHandler(async event => {
  try {
    // Get authorization header
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader) {
      return {
        data: {
          user: null
        }
      }
    }

    // Create Supabase client
    const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing',
      })
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseKey)

    // Get user from Supabase auth
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication failed',
      })
    }

    return {
      data: {
        user: user ? {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.updated_at
        } : null
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error while fetching user',
    })
  }
}) 