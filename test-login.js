import { createClient } from '@supabase/supabase-js'

// Use the same configuration as in nuxt.config.ts
const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testLogin() {
  console.log('🔍 Testing login for baltzakis.themis@gmail.com...')
  
  const email = 'baltzakis.themis@gmail.com'
  const password = 'testpass123'
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })
    
    console.log('📊 Login response:')
    console.log('Data:', JSON.stringify(data, null, 2))
    console.log('Error:', error)
    
    if (data?.user) {
      console.log('✅ Login successful! User ID:', data.user.id)
    } else {
      console.log('❌ Login failed')
    }
    
  } catch (err) {
    console.error('💥 Login error:', err)
  }
}

testLogin()
