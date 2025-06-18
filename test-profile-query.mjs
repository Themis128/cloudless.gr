/**
 * Quick test to check if profile query works now
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:8000'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ'

async function quickProfileTest() {
  console.log('🔍 Quick Profile Query Test')
  console.log('===========================')

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    // First login to get authentication
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'baltzakis.themis@gmail.com',
      password: 'TH!123789th!'
    })

    if (authError) {
      console.error('❌ Auth failed:', authError.message)
      return
    }

    console.log('✅ Authenticated as:', authData.user.email)

    // Now try profile query
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active, email_verified, full_name')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      console.error('❌ Profile query failed:', profileError.message)
    } else {
      console.log('✅ Profile query successful!')
      console.log('Profile data:', profile)
    }

  } catch (error) {
    console.error('🚨 Test failed:', error)
  }
}

quickProfileTest()
  .then(() => console.log('\n🏁 Profile test complete'))
  .catch(console.error)
