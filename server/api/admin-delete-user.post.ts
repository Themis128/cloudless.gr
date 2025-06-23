import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const adminUser = await serverSupabaseUser(event)
  if (!adminUser) {
    return { error: 'Not authenticated' }
  }

  // Check if adminUser has admin role (assuming user_profiles table has a 'role' column)
  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('role')
    .eq('id', adminUser.id)
    .single<{ role: string }>()

  if (profileError || !profile || profile.role !== 'admin') {
    return { error: 'Not authorized' }
  }

  // Get user id to delete from request body
  const body = await readBody(event)
  const { userId } = body || {}
  if (!userId) {
    return { error: 'Missing userId' }
  }

  // Delete user data from your tables (example: user_profiles)
  await client.from('user_profiles').delete().eq('id', userId)

  // Delete user from Supabase Auth (requires service role key)
  const { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } = process.env
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apiKey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  })

  if (!res.ok) {
    return { error: 'Failed to delete user from Auth' }
  }

  return { success: true }
})
