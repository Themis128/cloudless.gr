import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database, ProjectInsert } from '~/types/supabase.d'
export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)
  const user = await serverSupabaseUser(event)
  if (!user) {
    event.node.res.statusCode = 401
    return { error: { message: 'Not authenticated', code: 'not_authenticated' } }
  }

  let body
  try {
    body = await readBody(event)
  } catch {
    event.node.res.statusCode = 400
    return { error: { message: 'Invalid JSON payload', code: 'invalid_json' } }
  }
  const { name, description } = body || {}
  if (!name) {
    event.node.res.statusCode = 400
    return { error: { message: 'Project name is required', code: 'missing_name' } }
  }

  const insertObj: ProjectInsert = {
    name,
    description,
    owner_id: user.id,
    type: 'custom',
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }


  const { data, error } = await client
    .from('projects')
    .insert([insertObj])
    .single()

  const project = data as { id: string; name: string; status: string } | null

  if (error) {
    event.node.res.statusCode = 500
    return { error: { message: error.message, code: 'db_error' } }
  }

  return {
    project: project ? { id: project.id, name: project.name, status: project.status } : null
  }
})
