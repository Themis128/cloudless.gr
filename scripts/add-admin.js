#!/usr/bin/env node

// Script to add admin user to Supabase
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addAdminUser() {
  const email = 'baltzakis.themis@gmail.com'
  const password = 'TH!123789th!'
  const firstName = 'Themistoklis'
  const lastName = 'Baltzakis'

  try {
    console.log('🔧 Creating admin user...')
    
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`
      }
    })

    if (authError) {
      console.error('❌ Failed to create user in auth:', authError.message)
      return
    }

    console.log('✅ User created in auth system:', authData.user.id)    // 2. Create/Update profile with admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'id'
      })

    if (profileError) {
      console.error('❌ Failed to create profile:', profileError.message)
      return
    }

    console.log('✅ Admin profile created successfully')
    console.log('📧 Email:', email)
    console.log('👤 Name:', `${firstName} ${lastName}`)
    console.log('🛡️  Role: admin')
    console.log('🎉 Admin user setup complete!')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

addAdminUser()
