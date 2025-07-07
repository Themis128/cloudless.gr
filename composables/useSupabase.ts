
import type { SupabaseClient } from '@supabase/supabase-js'
import { useSupabaseClient } from '#imports'
import { useManualSupabaseClient } from './useManualSupabase'

// Singleton pattern to ensure only one client instance
let supabaseClientInstance: SupabaseClient | null = null
let isInitializing = false

export function getSupabaseClient(): SupabaseClient {
  // If we're already initializing, wait for it to complete
  if (isInitializing && !supabaseClientInstance) {
    // In this case, fall back to direct client to avoid deadlock
    console.warn('[SUPABASE] Client requested during initialization, using direct client')
    try {
      return useSupabaseClient()
    } catch (error) {
      console.warn('[SUPABASE] Direct client failed, trying manual client:', error)
      return useManualSupabaseClient()
    }
  }
  
  // Only create one instance and reuse it
  if (!supabaseClientInstance) {
    isInitializing = true
    try {
      // Try to use Nuxt's built-in client first
      try {
        supabaseClientInstance = useSupabaseClient()
        console.log('[SUPABASE] ✅ Using @nuxtjs/supabase singleton client instance')
      } catch (error) {
        console.warn('[SUPABASE] ⚠️ @nuxtjs/supabase client failed, using manual client:', error)
        supabaseClientInstance = useManualSupabaseClient()
        console.log('[SUPABASE] ✅ Using manual Supabase client instance')
      }
    } finally {
      isInitializing = false
    }
  }
  return supabaseClientInstance
}

/**
 * Setup user storage structure after login/registration
 * Creates necessary storage buckets and folders for the user
 */

export const setupUserStorage = async (supabase: SupabaseClient, userId: string) => {
  const bucket = 'user-files';
  const userFolder = `users/${userId}`;
  try {
    console.log('[STORAGE] Setting up storage for user:', userId);
    // Ensure bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) throw bucketError;
    if (!buckets.some((b: { id: string }) => b.id === bucket)) {
      const { error: createError } = await supabase.storage.createBucket(bucket, { public: false });
      if (createError) throw createError;
    }
    // Try to upload a .keep file to create the user folder if it doesn't exist
    let uploadError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { error } = await supabase.storage.from(bucket).upload(`${userFolder}/.keep`, '', { upsert: false });
      uploadError = error;
      if (!uploadError || (uploadError.message && uploadError.message.includes('The resource already exists'))) {
        break;
      }
      console.warn(`[STORAGE] Upload attempt ${attempt} failed:`, uploadError.message);
    }
    if (uploadError && !uploadError.message.includes('The resource already exists')) {
      throw uploadError;
    }
    console.log('[STORAGE] Storage setup complete for user folder:', userFolder);
    return true;
  } catch (error) {
    console.error('[STORAGE] Failed to setup user storage:', error);
    throw error;
  }
};
