import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

async function checkSupabaseSetup() {
  console.log('🔍 Starting Supabase configuration check...\n')
  console.log('Current environment:', process.env.NODE_ENV || 'development')

  // Check environment variables
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('❌ Missing required environment variables:')
    if (!url) console.error('   - SUPABASE_URL')
    if (!key) console.error('   - SUPABASE_ANON_KEY')
    process.exit(1)
  }

  console.log('✅ Environment variables found')

  // Initialize Supabase client
  const supabase = createClient(url, key)
  console.log('📡 Testing connection to Supabase...')

  try {
    // Test basic connection
    const { error: pingError } = await supabase.from('contact_submissions').select('count').limit(0)
    
    if (pingError) {
      if (pingError.code === 'PGRST116') {
        console.log('✅ Connected to Supabase successfully')
      } else {
        throw pingError
      }
    } else {
      console.log('✅ Connected to Supabase successfully')
    }

    // Test data operations if service role key is available
    if (serviceKey) {
      const adminClient = createClient(url, serviceKey)
      console.log('\n🔑 Testing administrative access...')
      
      // Try to access a secure table/function
      const { error: adminError } = await adminClient.rpc('check_admin_access', {})
      
      if (adminError && adminError.code !== 'PGRST116') {
        console.warn('⚠️  Admin access check failed:', adminError.message)
      } else {
        console.log('✅ Administrative access verified')
      }
    }    // Test auth configuration
    console.log('\n🔒 Testing authentication configuration...')
    const {
      data: { session },
      error: authError
    } = await supabase.auth.getSession()

    if (authError) {
      console.warn('⚠️  Auth configuration check failed:', authError.message)
    } else {      console.log('✅ Auth configuration is valid, session:', session ? 'active' : 'none')
    }

    // Overall status
    console.log('\n🎉 Supabase health check complete!')
    return true
  } catch (error: any) {
    console.error('\n❌ Supabase connection failed:', error.message || error)
    console.error('\nDebug information:')
    console.error('URL:', url.substring(0, 20) + '...')
    console.error('Error code:', error.code)
    console.error('Error details:', error.details)
    return false
  }
}

// Run the check if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkSupabaseSetup()
    .then((success) => {
      process.exit(success ? 0 : 1)
    })
    .catch((error) => {
      console.error('Unexpected error:', error)
      process.exit(1)
    })
}

export default checkSupabaseSetup
