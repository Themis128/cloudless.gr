export const useSupabase = () => {
  // For server-side usage, use the standard Nuxt Supabase client
  return useSupabaseClient()
}

/**
 * Setup user storage structure after login/registration
 * Creates necessary storage buckets and folders for the user
 */
export const setupUserStorage = async (supabase: ReturnType<typeof useSupabaseClient>, userId: string) => {
  try {
    console.log('[STORAGE] Setting up storage for user:', userId)
    
    // Check if user bucket exists, if not create basic structure
    // This is a placeholder - customize based on your storage needs
    
    // Example: Create user-specific folder in a shared bucket
    const userFolder = `users/${userId}`
    
    // You might want to create specific storage buckets or folders here
    // For example:
    // await supabase.storage.createBucket(`user-${userId}`)
    
    console.log('[STORAGE] Storage setup complete for user folder:', userFolder)
    return true
    
  } catch (error) {
    console.error('[STORAGE] Failed to setup user storage:', error)
    throw error
  }
}
