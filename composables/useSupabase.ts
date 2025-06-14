import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-safe composable: uses injected $supabase on client, creates client on server
export const useSupabase = (): SupabaseClient => {
  if (process.client) {
    const nuxtApp = useNuxtApp()
    return nuxtApp.$supabase as SupabaseClient
  }
  const config = useRuntimeConfig()
  return createClient(
    config.public.SUPABASE_URL,
    config.public.SUPABASE_ANON_KEY
  )
}

// Creates a user-specific folder in the given bucket if it doesn't exist
export async function setupUserStorage(
  supabase: SupabaseClient,
  userId: string
) {
  const bucket = 'users'
  const uploadPath = `${userId}/.init`
  const initBlob = new Blob(['init'], { type: 'text/plain' })

  // Optional: create bucket only if you’re sure this is a new project
  if (process.server) {
    const { error: bucketError } = await supabase.storage.createBucket(bucket, { public: false })
    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('[setupUserStorage] bucketError:', bucketError)
      throw bucketError
    }
  }

  // Always try to upload .init file to "activate" user folder for RLS
  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(uploadPath, initBlob, { upsert: false })

  if (uploadError && !uploadError.message.includes('already exists')) {
    console.error('[setupUserStorage] uploadError:', uploadError)
    throw uploadError
  }
}