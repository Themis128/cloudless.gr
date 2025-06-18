import { createClient } from '@supabase/supabase-js'

// Use the same configuration as in nuxt.config.ts
const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugRegistration() {
  console.log('🔍 Testing registration for baltzakis.themis@gmail.com...')
  console.log('📍 Using Supabase URL:', supabaseUrl)
  
  const email = 'baltzakis.themis@gmail.com'
  const password = 'testpass123'
  const firstName = 'Themis'
  const lastName = 'Baltzakis'
  
  try {
    console.log('📤 Sending registration request...')
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    })
    
    console.log('📊 Registration response:')
    console.log('Data:', JSON.stringify(data, null, 2))
    console.log('Error:', error)
    
    if (data?.user?.id) {
      console.log('✅ User created with ID:', data.user.id)
      
      // Try to create user profile
      console.log('👤 Creating user profile...')
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          id: data.user.id,
          full_name: `${firstName} ${lastName}`.trim() || null,
          role: 'user'
        }])
      
      if (profileError) {
        console.log('❌ Profile creation error:', profileError)
      } else {
        console.log('✅ Profile created successfully')
      }
      
      // Check if user exists in auth.users
      console.log('🔍 Checking if user exists in database...')
      const { data: users, error: queryError } = await supabase.auth.admin.listUsers()
      
      if (queryError) {
        console.log('❌ Error querying users:', queryError)
      } else {
        const foundUser = users.users.find(u => u.email === email)
        if (foundUser) {
          console.log('✅ User found in database:', foundUser.email)
        } else {
          console.log('❌ User NOT found in database')
        }
      }
    } else {
      console.log('❌ No user ID in response')
    }
    
  } catch (err) {
    console.error('💥 Registration error:', err)
  }
}

debugRegistration()
