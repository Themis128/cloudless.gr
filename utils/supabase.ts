import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable')
}

if (!supabaseKey) {
  throw new Error('Missing SUPABASE_KEY environment variable')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Add response interceptor to log errors
const originalRequest = supabase.rest.request.bind(supabase.rest)
supabase.rest.request = async (...args) => {
  try {
    const response = await originalRequest(...args)
    if (response.error) {
      console.error('Supabase request error:', {
        error: response.error,
        request: args[0],
        path: args[1]
      })
    }
    return response
  } catch (error) {
    console.error('Supabase client error:', error)
    throw error
  }
}

export default supabase
