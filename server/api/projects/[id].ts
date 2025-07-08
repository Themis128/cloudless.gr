import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/supabase.d'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)
  const user = await serverSupabaseUser(event)
  if (!user) {
    event.node.res.statusCode = 401
    return { error: { message: 'Not authenticated', code: 'not_authenticated' } }
  }

  const id = event.context.params?.id
  if (!id) {
    event.node.res.statusCode = 400
    return { error: { message: 'Missing project id', code: 'missing_id' } }
  }

  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    event.node.res.statusCode = 404
    return { error: { message: error.message, code: 'not_found' } }
  }

  return {
    project: data ? { id: data.id, name: data.name, status: data.status } : null
  }
})
