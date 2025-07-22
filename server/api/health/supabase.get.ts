import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'

export default defineEventHandler(async (event) => {
  try {
    // Get environment variables
    const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY

    // Check if environment variables are set
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'error',
        message: 'Supabase environment variables not configured',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
          urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'not set',
        },
        timestamp: new Date().toISOString(),
      }
    }

    // Create Supabase client
    const supabase = createClient<Database>(supabaseUrl, supabaseKey)

    // Test basic connection with a simple query
    const { data, error } = await supabase
      .from('bots')
      .select('id')
      .limit(1)

    if (error) {
      return {
        status: 'error',
        message: 'Supabase connection failed',
        details: {
          error: error.message,
          code: error.code,
          hint: error.hint,
        },
        timestamp: new Date().toISOString(),
      }
    }

    // Test authentication endpoint
    const { data: authData, error: authError } = await supabase.auth.getUser()

    return {
      status: 'success',
      message: 'Supabase connection successful',
      details: {
        url: supabaseUrl,
        connected: true,
        tablesAccessible: true,
        authWorking: !authError,
        sampleDataCount: data ? data.length : 0,
        authUser: authData?.user ? 'authenticated' : 'anonymous',
      },
      timestamp: new Date().toISOString(),
    }

  } catch (error: any) {
    return {
      status: 'error',
      message: 'Unexpected error during Supabase health check',
      details: {
        error: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
    }
  }
})