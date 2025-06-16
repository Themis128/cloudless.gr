#!/usr/bin/env node

// Script to add admin user via direct SQL approach
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function addAdminUserSimple() {
  const email = 'baltzakis.themis@gmail.com'
  const password = 'TH!123789th!'
  const firstName = 'Themistoklis'
  const lastName = 'Baltzakis'

  try {
    console.log('🔧 Creating admin user with email/password signup...')
    
    // 1. Try to sign up the user first
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`
        }
      }
    })

    if (signUpError) {
      console.log('ℹ️  Sign up failed (user might already exist):', signUpError.message)
      
      // Try to sign in instead
      console.log('🔑 Attempting to sign in existing user...')
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      })

      if (signInError) {
        console.error('❌ Sign in failed:', signInError.message)
        console.log('💡 You may need to create the user manually in Supabase Auth dashboard first')
        return
      }

      console.log('✅ Signed in existing user:', signInData.user.id)
      
      // Update profile to admin role
      await updateProfileToAdmin(signInData.user.id, email, firstName, lastName)
      
    } else {
      console.log('✅ User created successfully:', signUpData.user?.id)
      
      // Update profile to admin role
      if (signUpData.user?.id) {
        await updateProfileToAdmin(signUpData.user.id, email, firstName, lastName)
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

async function updateProfileToAdmin(userId, email, firstName, lastName) {
  try {
    console.log('👤 Updating profile to admin role...')
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        role: 'admin',
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'id'
      })

    if (profileError) {
      console.error('❌ Failed to update profile:', profileError.message)
      console.log('💡 You may need to create the profiles table first or update manually')
      return
    }

    console.log('✅ Admin profile updated successfully')
    console.log('📧 Email:', email)
    console.log('👤 Name:', `${firstName} ${lastName}`)
    console.log('🛡️  Role: admin')
    console.log('🎉 Admin user setup complete!')
    
  } catch (error) {
    console.error('❌ Profile update error:', error.message)
  }
}

addAdminUserSimple()
