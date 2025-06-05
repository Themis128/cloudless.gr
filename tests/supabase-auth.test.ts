import { createClient } from '@supabase/supabase-js'
import { expect, test } from 'vitest'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY!

console.log('[Test Setup] Loaded environment variables:')
console.log('[Test Setup] SUPABASE_URL:', SUPABASE_URL)
console.log('[Test Setup] SUPABASE_KEY:', SUPABASE_KEY ? SUPABASE_KEY.slice(0, 8) + '...' : 'NOT SET')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

test('Supabase Client > should verify auth connection', async () => {
  expect(supabase).toBeDefined()
  expect(typeof supabase.auth.signInWithPassword).toBe('function')

  const { data, error } = await supabase.auth.getSession()
  console.log('[Auth Test] Session result:', data)

  expect(error).toBeNull()
  expect(data.session).toBeNull() // no user logged in = expected
})
