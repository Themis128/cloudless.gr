import { supabase } from '../../composables/useSupabase'

export async function getUser(id: string) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
  if (error) throw error
  return data
}
