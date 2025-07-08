import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const user = await serverSupabaseUser(event)
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Fetch projects for the authenticated user
  const { data: projects, error } = await client
    .from('projects')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { projects }
})
