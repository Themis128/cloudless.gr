export default defineEventHandler(async (_event) => {
  try {
    console.log('🔍 Health check starting...')
    
    // Test Supabase connection
    const { createClient } = await import('@supabase/supabase-js')
    const config = useRuntimeConfig()
    
    const supabase = createClient(
      config.public.supabaseUrl as string,
      config.public.supabaseAnonKey as string
    )
    
    // Simple query to test connectivity
    const { data: _data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Supabase health check failed:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Database connection failed',
        data: { error: error.message }
      })
    }
    
    console.log('✅ Health check passed')
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      supabase: 'connected',
      message: 'All systems operational'
    }
  } catch (error) {
    console.error('❌ Health check error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Health check failed',
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    })
  }
})
