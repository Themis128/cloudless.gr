import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables from .env file
config()

async function checkSupabaseHealth() {
  console.log('🔍 Starting Supabase health check...\n')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('❌ Missing required Supabase configuration!')
    if (!url) console.error('Missing SUPABASE_URL')
    if (!key) console.error('Missing SUPABASE_ANON_KEY')
    process.exit(1)
  }

  console.log('✅ Found Supabase configuration')
  console.log(`URL: ${url.substring(0, 20)}...`)
  
  try {
    const supabase = createClient(url, key)
    console.log('\n📡 Testing connection...')

    const { error } = await supabase
      .from('contact_submissions')
      .select('count')
      .limit(0)

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    console.log('✅ Successfully connected to Supabase!\n')
    
    if (serviceKey) {
      console.log('🔑 Testing service role access...')
      const adminClient = createClient(url, serviceKey)
      const { error: adminError } = await adminClient
        .from('contact_submissions')
        .select('count')
        .limit(0)

      if (adminError && adminError.code !== 'PGRST116') {
        console.warn('⚠️ Service role access check failed:', adminError.message)
      } else {
        console.log('✅ Service role access verified')
      }
    }

    console.log('\n🎉 All checks passed! Supabase is properly configured.')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Connection failed:', error.message || error)
    console.error('\nDebug information:')
    console.error('Error code:', error.code)
    console.error('Error details:', error.details || 'No additional details')
    process.exit(1)
  }
}

// Run the health check
checkSupabaseHealth()
