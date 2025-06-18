/**
 * Simple test to verify registration works through the useRobustAuth composable
 * This tests the same path the registration form uses
 */

import { createClient } from '@supabase/supabase-js'

// Load environment variables
const SUPABASE_URL = 'http://127.0.0.1:8000'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ'

async function testRobustAuthRegistration() {
  console.log('🚀 Testing Registration via useRobustAuth path')
  console.log('==============================================')

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const timestamp = Date.now()
  const testData = {
    email: `testform${timestamp}@example.com`,
    password: 'TestPassword123!',
    full_name: `Test Form User ${timestamp}`
  }

  console.log('📧 Test user:', testData.email)

  try {
    // This mirrors the signUp function in useRobustAuth
    console.log('🔄 Attempting registration...')

    const { data, error } = await supabase.auth.signUp({
      email: testData.email,
      password: testData.password,
      options: {
        data: {
          full_name: testData.full_name
        }
      }
    })

    if (error) {
      console.error('❌ Registration error:', error.message)
      return { success: false, error: error.message }
    }

    if (!data.user) {
      console.error('❌ No user returned from registration')
      return { success: false, error: 'No user returned' }
    }

    console.log('✅ Registration successful!')
    console.log('👤 User ID:', data.user.id)
    console.log('📧 Email:', data.user.email)
    console.log('✅ Email confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No')
    console.log('🔑 Session created:', data.session ? 'Yes' : 'No')

    // Check if this would require email verification in a real scenario
    const requiresEmailVerification = !data.user.email_confirmed_at && !data.session

    console.log('📬 Email verification required:', requiresEmailVerification ? 'Yes' : 'No')

    return {
      success: true,
      user: data.user,
      session: data.session,
      requiresEmailVerification
    }

  } catch (error) {
    console.error('🚨 Unexpected error:', error)
    return { success: false, error: error.message }
  }
}

// Run the test
testRobustAuthRegistration()
  .then(result => {
    console.log('\n==============================================')
    if (result.success) {
      console.log('✅ useRobustAuth Registration Test: PASSED')
      console.log('🎉 The registration form should work correctly!')
    } else {
      console.log('❌ useRobustAuth Registration Test: FAILED')
      console.log('🚨 Error:', result.error)
    }
    console.log('==============================================')
  })
  .catch(console.error)
