#!/usr/bin/env node

// Generic script to add any user to Supabase with specified role
// Usage: node scripts/add-user.js <email> <firstName> <lastName> <role> [password]
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import crypto from 'crypto'

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

// Get command line arguments
const args = process.argv.slice(2)

if (args.length < 4) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📖 Usage: node scripts/add-user.js <email> <firstName> <lastName> <role> [password]')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Examples:')
  console.log('  node scripts/add-user.js john@example.com John Doe admin')
  console.log('  node scripts/add-user.js jane@example.com Jane Smith user mypassword123')
  console.log('')
  console.log('Roles: admin, user, moderator')
  console.log('If no password is provided, a secure random password will be generated.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  process.exit(1)
}

const [email, firstName, lastName, role, providedPassword] = args

// Validate role
const validRoles = ['admin', 'user', 'moderator']
if (!validRoles.includes(role)) {
  console.error(`❌ Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`)
  process.exit(1)
}

// Generate secure password if not provided
const password = providedPassword || crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '') + '!A1'

async function addUser() {
  try {
    console.log(`🔧 Adding ${firstName} ${lastName} as ${role}...`)
    console.log(`📧 Email: ${email}`)
    
    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const userExists = existingUser.users.find(user => user.email === email)
    
    let userId
    
    if (userExists) {
      console.log('⚠️  User already exists in auth system')
      userId = userExists.id
      console.log(`🆔 Existing User ID: ${userId}`)
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
      console.log('✅ User created in auth system')
      console.log(`🆔 New User ID: ${userId}`)
    }    // Create/Update profile with specified role
    let roleEmoji = '👤'
    if (role === 'admin') roleEmoji = '🛡️'
    else if (role === 'moderator') roleEmoji = '🛂'
    
    console.log(`${roleEmoji} Setting up ${role} profile...`)
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        role: role,
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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ User setup completed successfully!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📧 Email:', email)
    console.log('👤 Name:', `${firstName} ${lastName}`)
    console.log('🆔 User ID:', userId)
    console.log(`${roleEmoji} Role:`, profile?.role || role)
    console.log('🔑 Password:', providedPassword ? '(provided by user)' : password)
    console.log('📅 Created:', profile?.created_at)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    if (!providedPassword) {
      console.log('⚠️  IMPORTANT: Save this password! It won\'t be shown again.')
      console.log(`🔑 Generated Password: ${password}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    console.error(error)
  }
}

// Run the script
addUser()
