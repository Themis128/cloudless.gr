/**
 * Test login functionality to diagnose the issue
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:8000'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ'

async function testLogin(testCredentials) {
  console.log('🔐 Testing Login Functionality')
  console.log('=============================')

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  console.log('🔑 Testing with user:', testCredentials.email)

  try {
    // Test 1: Direct login attempt
    console.log('\n🔄 Step 1: Attempting login...')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: testCredentials.email,
      password: testCredentials.password
    })

    if (error) {
      console.error('❌ Login error:', error.message)
      return { success: false, error: error.message }
    }

    if (!data.user) {
      console.error('❌ No user returned from login')
      return { success: false, error: 'No user returned' }
    }

    console.log('✅ Login successful!')
    console.log('👤 User ID:', data.user.id)
    console.log('📧 Email:', data.user.email)
    console.log('✅ Email confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No')
    console.log('🔑 Session created:', data.session ? 'Yes' : 'No')

    // Test 2: Check user profile
    console.log('\n🔄 Step 2: Checking user profile...')

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('⚠️  Profile error:', profileError.message)
      console.log('ℹ️  This might be due to RLS policies or missing profile')
    } else {
      console.log('✅ Profile found:')
      console.log('   Name:', profile.full_name || 'No name')
      console.log('   Role:', profile.role || 'No role')
      console.log('   Active:', profile.is_active)
      console.log('   Email verified:', profile.email_verified)
    }

    // Test 3: Check current session
    console.log('\n🔄 Step 3: Checking current session...')

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      console.log('✅ User is authenticated')
      console.log('   Can access protected routes: Yes')
    } else {
      console.log('❌ User not authenticated')
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      profile: profile || null
    }

  } catch (error) {
    console.error('🚨 Unexpected error:', error)
    return { success: false, error: error.message }
  }
}

// Test with user's actual credentials
async function testLoginFlow() {
  console.log('🚀 Testing Login with User Credentials')
  console.log('=====================================')

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // Use actual user credentials
  const testUser = {
    email: 'baltzakis.themis@gmail.com',
    password: 'TH!123789th!',
    full_name: 'Themis Baltzakis'
  }

  console.log('📝 Testing login with user:', testUser.email)

  try {
    // Check if user exists first
    console.log('\n🔍 Step 1: Checking if user exists...')

    // Try to login directly since user should already exist
    const loginResult = await testLogin(testUser)

    if (loginResult.success) {
      console.log('\n✅ Login flow test: PASSED')
      console.log('🎉 Login functionality is working correctly!')
    } else {
      console.log('\n❌ Login flow test: FAILED')
      console.log('Error:', loginResult.error)

      // If login fails, try to register the user first
      console.log('\n🔄 Attempting to register user first...')
      const { error: regError } = await supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.full_name
          }
        }
      })

      if (regError) {
        console.error('❌ Registration also failed:', regError.message)
        return
      }

      console.log('✅ User registered successfully')

      // Try login again
      await supabase.auth.signOut()
      console.log('🔄 Now testing login after registration...')

      const secondLoginResult = await testLogin(testUser)
      if (secondLoginResult.success) {
        console.log('\n✅ Login after registration: PASSED')
      } else {
        console.log('\n❌ Login after registration: FAILED')
        console.log('Error:', secondLoginResult.error)
      }
    }

  } catch (error) {
    console.error('🚨 Login flow test error:', error)
  }
}

// Run both tests
testLoginFlow()
  .then(() => console.log('\n🔚 Tests completed'))
  .catch(console.error)
