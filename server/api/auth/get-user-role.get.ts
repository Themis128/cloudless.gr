import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    // Get Supabase configuration
    const config = useRuntimeConfig()
    const supabaseUrl = config.public.supabaseUrl as string
    const serviceKey = config.supabaseServiceKey as string
    
    if (!supabaseUrl || !serviceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Missing Supabase configuration'
      })
    }
    
    // Get the user's session from cookies
    const cookies = parseCookies(event)
    const authToken = cookies['sb-localhost-auth-token'] || cookies['supabase-auth-token']
    
    if (!authToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'No authentication token found'
      })
    }
    
    // Parse the auth token to get user ID
    let userId: string | null = null
    try {
      const tokenData = JSON.parse(authToken)
      userId = tokenData?.user?.id || tokenData?.access_token ? 
        JSON.parse(atob(tokenData.access_token.split('.')[1])).sub : null
    } catch (parseError) {
      console.error('Error parsing auth token:', parseError)
    }
    
    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid authentication token'
      })
    }
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceKey)
    
    // Get user role from profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Error fetching user role:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch user role'
      })
    }
    
    return {
      role: data?.role || 'user',
      userId
    }
  } catch (error) {
    console.error('Error in get-user-role API:', error)
    
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
