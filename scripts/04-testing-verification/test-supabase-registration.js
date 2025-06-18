/**
 * Test Supabase Registration API
 * This tests the registration functionality using the Supabase JavaScript client
 */

import { createClient } from '@supabase/supabase-js'

// Use the same configuration as in the .env file
const supabaseUrl = 'http://127.0.0.1:8000'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testRegistration() {
  console.log('🧪 Testing Supabase Registration API')
  console.log('📍 Supabase URL:', supabaseUrl)
  console.log('')

  const testUser = {
    email: 'test@example.com',
    password: 'TestPass123',
    fullName: 'Test User'
  }

  try {
    console.log('🔄 Attempting to register user:', testUser.email)

    const { data, error } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: {
          full_name: testUser.fullName
        }
      }
    })

    console.log('📊 Registration Response:')
    console.log('Success:', !error)
    console.log('Error:', error)
    console.log('User ID:', data?.user?.id)
    console.log('Email:', data?.user?.email)
    console.log('Email Confirmed:', data?.user?.email_confirmed_at ? 'Yes' : 'No')
    console.log('')

    if (error) {
      console.log('❌ Registration failed:', error.message)
      return false
    }

    if (data?.user) {
      console.log('✅ Registration successful!')
      console.log('User created with ID:', data.user.id)

      // Test if we can fetch the user profile
      console.log('🔍 Checking user profile...')
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        console.log('⚠️  Profile fetch error:', profileError.message)
      } else {
        console.log('✅ Profile found:', profile)
      }

      return true
    }

  } catch (err) {
    console.error('💥 Unexpected error:', err)
    return false
  }
}

// Test API connection first
async function testConnection() {
  console.log('🔗 Testing Supabase Auth API connection...')

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    })
    if (response.ok) {
      console.log('✅ Supabase Auth API is accessible')
      return true
    } else {
      console.log('❌ Supabase Auth API returned status:', response.status)
      return false
    }
  } catch (err) {
    console.log('❌ Cannot connect to Supabase Auth API:', err.message)
    return false
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Supabase Registration Tests')
  console.log('=====================================')
  console.log('')

  const connectionOk = await testConnection()
  if (!connectionOk) {
    console.log('❌ Cannot proceed - Supabase API is not accessible')
    process.exit(1)
  }

  console.log('')
  const success = await testRegistration()

  console.log('')
  console.log('=====================================')
  console.log(success ? '✅ All tests passed!' : '❌ Tests failed!')
}

runTests().catch(console.error)
