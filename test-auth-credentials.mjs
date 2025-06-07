import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

console.log('🔍 Testing Authentication for: baltzakis.themis@gmail.com')
console.log('🔗 Supabase URL:', supabaseUrl)
console.log('🔑 Using API Key:', supabaseKey ? supabaseKey.slice(0, 20) + '...' : 'NOT SET')

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAuth() {
  try {
    console.log('\n1️⃣ Testing Supabase connection...')
    
    // Test basic connection
    const { data: healthData, error: healthError } = await supabase
      .from('contact_submissions')
      .select('count')
      .limit(0)
    
    if (healthError && healthError.code !== 'PGRST116') {
      console.log('❌ Connection error:', healthError.message)
      return
    }
    
    console.log('✅ Supabase connection successful')

    console.log('\n2️⃣ Attempting to sign in with your credentials...')
    
    // Test the specific credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'baltzakis.themis@gmail.com',
      password: 'TH!123789th!'
    })

    if (signInError) {
      console.log('❌ Sign-in failed with error:', signInError.message)
      console.log('   Error code:', signInError.status)
      
      // Provide specific guidance based on error
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('\n🔍 Possible causes:')
        console.log('   1. Account not created yet')
        console.log('   2. Email not confirmed')
        console.log('   3. Incorrect password')
        console.log('   4. User created with different provider (Google, etc.)')
        
        console.log('\n3️⃣ Checking if user exists in auth.users...')
        
        // Try to get user info (this requires service role, but let's try)
        const { data: userData, error: userError } = await supabase.auth.getUser()
        console.log('User lookup result:', userData, userError?.message)
        
      } else if (signInError.message.includes('Email not confirmed')) {
        console.log('\n📧 Your email needs to be confirmed!')
        console.log('   1. Check your email for confirmation link')
        console.log('   2. Click the link to confirm your account')
        console.log('   3. Or use the "Resend confirmation" option on login page')
      }
    } else {
      console.log('✅ Sign-in successful!')
      console.log('   User ID:', signInData.user?.id)
      console.log('   Email:', signInData.user?.email)
      console.log('   Email confirmed:', signInData.user?.email_confirmed_at ? 'Yes' : 'No')
    }

    console.log('\n4️⃣ Testing sign-up (to see if account exists)...')
    
    // Try to sign up with same credentials to see what happens
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'baltzakis.themis@gmail.com',
      password: 'TH!123789th!'
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        console.log('✅ Account exists - email confirmation might be needed')
      } else {
        console.log('❌ Sign-up error:', signUpError.message)
      }
    } else {
      if (signUpData.user && !signUpData.session) {
        console.log('📧 Account created - confirmation email sent')
      } else if (signUpData.session) {
        console.log('✅ Account exists and is confirmed')
      }
    }

  } catch (err) {
    console.log('❌ Unexpected error:', err.message)
  }
}

testAuth()
