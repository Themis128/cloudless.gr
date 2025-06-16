#!/usr/bin/env node

// Complete seeding script for Supabase after reset
// This creates actual auth users and their profiles
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

// Seed data configuration
const seedUsers = [
  {
    email: 'baltzakis.themis@gmail.com',
    password: 'TH!123789th!',
    firstName: 'Themistoklis',
    lastName: 'Baltzakis',
    username: 'themis',
    role: 'admin',
    bio: 'Main administrator and developer'
  },
  {
    email: 'john.doe@example.com',
    password: 'AdminPass123!',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    role: 'admin',
    bio: 'System administrator'
  },
  {
    email: 'jane.smith@example.com',
    password: 'ModPass123!',
    firstName: 'Jane',
    lastName: 'Smith',
    username: 'janesmith',
    role: 'moderator',
    bio: 'Content moderator'
  },
  {
    email: 'bob.wilson@example.com',
    password: 'UserPass123!',
    firstName: 'Bob',
    lastName: 'Wilson',
    username: 'bobwilson',
    role: 'user',
    bio: 'Regular user'
  },
  {
    email: 'alice.johnson@example.com',
    password: 'UserPass123!',
    firstName: 'Alice',
    lastName: 'Johnson',
    username: 'alicejohnson',
    role: 'user',
    bio: 'Regular user'
  },
  {
    email: 'mike.admin@example.com',
    password: 'AdminPass123!',
    firstName: 'Mike',
    lastName: 'Admin',
    username: 'mikeadmin',
    role: 'admin',
    bio: 'Secondary administrator'
  }
]

async function createUserWithProfile(userData) {
  const { email, password, firstName, lastName, username, role, bio } = userData
  
  try {
    console.log(`👤 Creating user: ${firstName} ${lastName} (${role})`)
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        username: username,
        role: role
      }
    })

    if (authError) {
      console.error(`❌ Failed to create auth user for ${email}:`, authError.message)
      return { success: false, error: authError.message }
    }

    console.log(`✅ Auth user created: ${authData.user.id}`)

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        username: username,
        role: role,
        bio: bio,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.error(`❌ Failed to create profile for ${email}:`, profileError.message)
      return { success: false, error: profileError.message }
    }

    console.log(`✅ Profile created for ${firstName} ${lastName}`)
    return { 
      success: true, 
      userId: authData.user.id, 
      email: email, 
      role: role,
      name: `${firstName} ${lastName}`
    }

  } catch (error) {
    console.error(`❌ Unexpected error creating user ${email}:`, error.message)
    return { success: false, error: error.message }
  }
}

async function seedAllUsers() {
  console.log('🌱 Starting Supabase seeding process...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  const results = {
    successful: [],
    failed: [],
    admins: 0,
    moderators: 0,
    users: 0
  }

  // Process each user
  for (let i = 0; i < seedUsers.length; i++) {
    const userData = seedUsers[i]
    console.log(`\n[${i + 1}/${seedUsers.length}] Processing ${userData.email}...`)
    
    const result = await createUserWithProfile(userData)
    
    if (result.success) {
      results.successful.push(result)
      if (result.role === 'admin') results.admins++
      else if (result.role === 'moderator') results.moderators++
      else results.users++
    } else {
      results.failed.push({ email: userData.email, error: result.error })
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Show final results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 SEEDING COMPLETED!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  console.log('📊 STATISTICS:')
  console.log(`   👥 Total Users: ${results.successful.length}`)
  console.log(`   🛡️  Admins: ${results.admins}`)
  console.log(`   🛂 Moderators: ${results.moderators}`)
  console.log(`   👤 Regular Users: ${results.users}`)
  
  if (results.failed.length > 0) {
    console.log(`   ❌ Failed: ${results.failed.length}`)
  }
  console.log('\n✅ SUCCESSFULLY CREATED:')
  results.successful.forEach(user => {
    let roleEmoji = '👤'
    if (user.role === 'admin') roleEmoji = '🛡️'
    else if (user.role === 'moderator') roleEmoji = '🛂'
    console.log(`   ${roleEmoji} ${user.name} (${user.email}) - ${user.role}`)
  })

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TO CREATE:')
    results.failed.forEach(failure => {
      console.log(`   ❌ ${failure.email}: ${failure.error}`)
    })
  }

  console.log('\n🔑 DEFAULT PASSWORDS:')
  console.log('   • Themistoklis: TH!123789th!')
  console.log('   • Admins: AdminPass123!')
  console.log('   • Moderators: ModPass123!')
  console.log('   • Users: UserPass123!')
  
  console.log('\n🌐 ACCESS:')
  console.log('   • Supabase Studio: http://localhost:54323')
  console.log('   • API Endpoint: http://localhost:8000')
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// Verification function
async function verifySeeding() {
  console.log('\n🔍 Verifying seeded data...')
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email, full_name, role, created_at')
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Failed to verify seeding:', error.message)
    return
  }
  console.log('\n📋 CURRENT DATABASE USERS:')
  profiles.forEach(profile => {
    let roleEmoji = '👤'
    if (profile.role === 'admin') roleEmoji = '🛡️'
    else if (profile.role === 'moderator') roleEmoji = '🛂'
    console.log(`   ${roleEmoji} ${profile.full_name} (${profile.email}) - ${profile.role}`)
  })
}

// Main execution
async function main() {
  try {
    await seedAllUsers()
    await verifySeeding()
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error.message)
    process.exit(1)
  }
}

// Handle command line arguments
const args = process.argv.slice(2)
if (args.includes('--verify-only')) {
  verifySeeding()
} else {
  main()
}
