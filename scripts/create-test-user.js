#!/usr/bin/env node

/**
 * Create Test User Script
 * Creates a test user with known credentials for development
 */

import { createClient } from '@supabase/supabase-js'

// Your Supabase configuration
const supabaseUrl = 'http://localhost:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestUser() {
  const testUser = {
    email: 'test@cloudless.gr',
    password: 'Test123!',
    email_confirm: true
  }

  console.log('🔄 Creating test user...')
  console.log(`📧 Email: ${testUser.email}`)
  console.log(`🔑 Password: ${testUser.password}`)
  
  try {
    // Create the user
    const { data, error } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test User',
        first_name: 'Test',
        last_name: 'User'
      }
    })

    if (error) {
      console.error('❌ Error creating user:', error.message)
      return
    }

    console.log('✅ Test user created successfully!')
    console.log(`👤 User ID: ${data.user.id}`)
    console.log(`📧 Email: ${data.user.email}`)
    
    // Create profile entry
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: testUser.email,
        first_name: 'Test',
        last_name: 'User',
        full_name: 'Test User',
        username: 'testuser',
        role: 'user',
        is_active: true,
        email_verified: true
      })

    if (profileError) {
      console.log('⚠️  Profile creation failed (table might not exist):', profileError.message)
    } else {
      console.log('✅ Profile created successfully!')
    }

    console.log('\n🎉 You can now login with:')
    console.log(`📧 Email: ${testUser.email}`)
    console.log(`🔑 Password: ${testUser.password}`)

  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

// Run the script
createTestUser()
