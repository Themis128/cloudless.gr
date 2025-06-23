import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const adminUser = await serverSupabaseUser(event)
  if (!adminUser) {
    return { error: 'Not authenticated' }
  }

  // Check if adminUser has admin role (assuming profiles table has a 'role' column)
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', adminUser.id)
    .single<{ role: string }>()

  if (profileError || !profile || profile.role !== 'admin') {
    return { error: 'Not authorized' }
  }

  // Get user email from request body
  const body = await readBody(event)
  const { email } = body || {}
  if (!email) {
    return { error: 'Missing email' }
  }

  // Unlock the user by resetting failed_login_attempts and locked_until
  const { error: updateError } = await client
    .from('profiles')
    .update({ failed_login_attempts: 0, locked_until: null })
    .eq('email', email)

  if (updateError) {
    return { error: 'Failed to unlock user', details: updateError.message }
  }

  return { success: true }
})
