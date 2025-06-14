import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-safe composable: uses injected $supabase on client, creates client on server
export const useSupabase = (): SupabaseClient => {
  if (process.client) {
    // @ts-ignore: Nuxt auto-injects $supabase
    return useNuxtApp().$supabase
  } else {
    const config = useRuntimeConfig()
    return createClient(
      config.public.SUPABASE_URL,
      config.public.SUPABASE_ANON_KEY
    )
  }
}

// Creates a user-specific folder in the given bucket if it doesn't exist
export async function setupUserStorage(
  supabase: SupabaseClient,
  userId: string
) {
  // Use a shared 'users' bucket for all user files
  const bucket = 'users';
  console.log('[setupUserStorage] bucket:', bucket);
  console.log('[setupUserStorage] userId:', userId);
  // Only attempt to create the bucket on the server side
  if (process.server) {
    const { error: bucketError } = await supabase.storage.createBucket(bucket, {
      public: false
    });
    if (bucketError) {
      console.error('[setupUserStorage] bucketError:', bucketError);
    }
    // Ignore error if bucket already exists
    if (bucketError && !bucketError.message.includes('already exists')) {
      throw bucketError;
    }
  }
  // Upload a placeholder file to the user's folder to satisfy RLS
  const uploadPath = `${userId}/.init`;
  console.log('[setupUserStorage] uploadPath:', uploadPath);
  const { error: uploadError } = await supabase.storage.from(bucket).upload(uploadPath, new Blob(['init']), {
    upsert: false
  });
  if (uploadError) {
    console.error('[setupUserStorage] uploadError:', uploadError);
  }
  if (uploadError && !uploadError.message.includes('already exists')) {
    throw uploadError;
  }
}