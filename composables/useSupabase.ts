import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

export const useSupabase = () => {
  const config = useRuntimeConfig()
  return createClient(
    config.public.SUPABASE_URL,
    config.public.SUPABASE_ANON_KEY
  )
}

// Creates a user-specific folder in the given bucket if it doesn't exist
export async function setupUserStorage(
  supabase: SupabaseClient,
  userId: string,
  bucket = 'user-files'
) {
  // Try to create a folder by uploading a placeholder file (Supabase has no explicit folder API)
  const folderPath = `${userId}/.init`;
  const { error } = await supabase.storage.from(bucket).upload(folderPath, new Blob(['init']), {
    upsert: false
  })
  // If error is 'The resource already exists', that's fine
  if (error && !error.message.includes('already exists')) {
    throw error
  }
}