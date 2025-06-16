#!/usr/bin/env node

// Script to add you (Themistoklis Baltzakis) as a regular user to Supabase
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

async function addThemisAsUser() {
  // Your details
  const email = 'baltzakis.themis@gmail.com'
  const password = 'TH!123789th!' // You can change this password
  const firstName = 'Themistoklis'
  const lastName = 'Baltzakis'

  try {
    console.log('🔧 Adding Themistoklis Baltzakis as regular user...')
    
    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const userExists = existingUser.users.find(user => user.email === email)
    
    let userId
    
    if (userExists) {
      console.log('👤 User already exists in auth system')
      userId = userExists.id
    } else {
      // Create user in Supabase Auth
      console.log('📝 Creating new user in auth system...')
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
      
      userId = authData.user.id
      console.log('✅ User created in auth system:', userId)
    }

    // Create/Update profile with user role
    console.log('👤 Setting up user profile...')
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        role: 'user', // Regular user role
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'id'
      })

    if (profileError) {
      console.error('❌ Failed to create/update profile:', profileError.message)
      return
    }

    // Verify the setup
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    console.log('✅ User profile created/updated successfully')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📧 Email:', email)
    console.log('👤 Name:', `${firstName} ${lastName}`)
    console.log('🆔 User ID:', userId)
    console.log('👨‍💼 Role:', profile?.role || 'user')
    console.log('📅 Created:', profile?.created_at)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 Themistoklis is now set up as a regular user!')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    console.error(error)
  }
}

// Run the script
addThemisAsUser()
