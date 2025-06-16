#!/usr/bin/env node

// Script to retrieve all needed keys from the database
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env')
  console.log('💡 Check your .env file or Supabase dashboard for the service role key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function retrieveKeys() {
  console.log('🔍 Retrieving all needed keys from database...\n')

  try {    // 1. Get JWT Secret
    console.log('1️⃣ JWT SECRET:')
    const { data: jwtData } = await supabase
      .rpc('get_jwt_secret')
      .single()
    
    if (jwtData) {
      console.log(`   JWT_SECRET=${JSON.stringify(jwtData)}`)
    } else {
      console.log('   ⚠️  JWT secret not accessible via RPC')
      console.log('   💡 Check your Supabase dashboard → Settings → API → JWT Settings')
    }
    console.log('')

    // 2. Get your user info
    console.log('2️⃣ YOUR USER INFO:')
    const { data: userData } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .eq('email', 'baltzakis.themis@gmail.com')
      .single()

    if (userData) {
      console.log(`   USER_ID: ${userData.id}`)
      console.log(`   EMAIL: ${userData.email}`)
      console.log(`   CREATED: ${userData.created_at}`)
    } else {
      console.log('   ⚠️  User not found in auth system')
      console.log('   💡 You may need to register first')
    }
    console.log('')

    // 3. Check profile status
    console.log('3️⃣ PROFILE STATUS:')
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, role, first_name, last_name')
      .eq('email', 'baltzakis.themis@gmail.com')
      .single()

    if (profileData) {
      console.log(`   PROFILE EXISTS: Yes`)
      console.log(`   CURRENT ROLE: ${profileData.role || 'none'}`)
      console.log(`   NAME: ${profileData.first_name} ${profileData.last_name}`)
    } else {
      console.log('   PROFILE EXISTS: No')
      console.log('   💡 Profile needs to be created')
    }
    console.log('')

    // 4. Database connection info
    console.log('4️⃣ CONNECTION INFO:')
    console.log(`   SUPABASE_URL: ${supabaseUrl}`)
    console.log(`   CONNECTION: ${supabaseUrl.includes('localhost') ? 'Local' : 'Remote'}`)
    console.log('')

    // 5. Provide next steps
    console.log('5️⃣ NEXT STEPS:')
    if (!userData) {
      console.log('   → First register at: /auth/register')
    } else if (!profileData) {
      console.log('   → Run admin setup script to create profile')
    } else if (profileData.role !== 'admin') {
      console.log('   → Update your role to admin in database')
    } else {
      console.log('   ✅ You are already set up as admin!')
    }

    console.log('\n📝 REQUIRED .ENV VARIABLES:')
    console.log('   SUPABASE_URL=your_supabase_url')
    console.log('   SUPABASE_ANON_KEY=your_anon_key')
    console.log('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
    console.log('   JWT_SECRET=your_jwt_secret')

  } catch (error) {
    console.error('❌ Error retrieving keys:', error.message)
    console.log('\n💡 Alternative: Check your Supabase dashboard manually:')
    console.log('   1. Go to https://app.supabase.com')
    console.log('   2. Select your project')
    console.log('   3. Go to Settings → API')
    console.log('   4. Copy the keys to your .env file')
  }
}

retrieveKeys()
