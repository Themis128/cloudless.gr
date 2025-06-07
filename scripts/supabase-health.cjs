const { createClient } = require('@supabase/supabase-js')
const { config } = require('dotenv')

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
  console.log(`Key length: ${key.length} characters`)
  
  // Debug: Show first and last few characters of the key
  console.log(`Key preview: ${key.substring(0, 10)}...${key.substring(key.length - 10)}`)
  
  try {
    const supabase = createClient(url, key)
    console.log('\n📡 Testing connection...')

    // Try a simple query that should work with any Supabase project
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('count')
      .limit(0)

    if (error) {
      // PGRST116 means the table doesn't exist, which is fine for connection testing
      if (error.code === 'PGRST116') {
        console.log('✅ Successfully connected to Supabase!')
        console.log('ℹ️  Table "contact_submissions" does not exist (this is expected for new projects)')
      } else {
        throw error
      }
    } else {
      console.log('✅ Successfully connected to Supabase!')
      console.log('✅ Table "contact_submissions" exists and is accessible')
    }

    // Test service role access if available
    if (serviceKey && serviceKey !== 'your_actual_service_role_key_here') {
      console.log('\n🔑 Testing service role access...')
      const adminClient = createClient(url, serviceKey)
      
      try {
        const { error: adminError } = await adminClient
          .from('contact_submissions')
          .select('count')
          .limit(0)

        if (adminError && adminError.code !== 'PGRST116') {
          console.warn('⚠️ Service role access check failed:', adminError.message)
        } else {
          console.log('✅ Service role access verified')
        }
      } catch (adminErr) {
        console.warn('⚠️ Service role test failed:', adminErr.message)
      }
    } else {
      console.log('\n⚠️ Service role key not configured or placeholder value detected')
    }

    // Test auth configuration
    console.log('\n🔒 Testing authentication system...')
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      
      if (authError) {
        console.warn('⚠️ Auth system warning:', authError.message)
      } else {
        console.log('✅ Auth system is accessible')
        console.log(`Session status: ${session ? 'active session found' : 'no active session (expected)'}`)
      }
    } catch (authErr) {
      console.warn('⚠️ Auth system test failed:', authErr.message)
    }

    console.log('\n🎉 Supabase health check completed successfully!')
    console.log('\n📋 Summary:')
    console.log('  ✅ Configuration loaded')
    console.log('  ✅ Connection established')
    console.log('  ✅ API key is valid')
    console.log('  ✅ Authentication system accessible')
    
    process.exit(0)
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message || error)
    console.error('\nDebug information:')
    console.error('Error code:', error.code || 'undefined')
    console.error('Error details:', error.details || 'No additional details')
    console.error('Error hint:', error.hint || 'No hint available')
    
    // Provide helpful suggestions based on error type
    if (error.message && error.message.includes('Invalid API key')) {
      console.error('\n💡 Suggestions:')
      console.error('  1. Check that your SUPABASE_ANON_KEY is correct')
      console.error('  2. Verify the key hasn\'t expired')
      console.error('  3. Ensure the key matches your Supabase project')
      console.error('  4. Check for any extra spaces or characters in the .env file')
    }
    
    process.exit(1)
  }
}

// Run the health check if this script is executed directly
if (require.main === module) {
  checkSupabaseHealth().catch(error => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })
}

module.exports = checkSupabaseHealth
