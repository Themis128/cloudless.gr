/**
 * Enhanced Supabase Authentication Composable
 */
export const useSupabaseAuth = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  // Sign in with email and password
  const signIn = async (email: string, password: string, requireAdminRole = false) => {
    try {
      console.log('🔐 signIn called with:', { email, requireAdminRole })
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      })
      
      console.log('📊 Supabase signInWithPassword response:', { data, error })
      
      if (error) {
        console.log('❌ SignIn error:', error)
        throw error
      }

      // If admin role is required, check the user's role
      if (requireAdminRole && data.user) {
        console.log('🔍 Checking admin role...')
        const role = await getUserRole()
        console.log('👤 User role:', role)
        if (role !== 'admin') {
          await signOut()
          throw new Error('Admin access required')
        }
      }

      console.log('✅ SignIn successful')
      return data
    } catch (err) {
      console.error('[signIn error]', err)
      throw err
    }
  }

  // Sign up with email and password
  const signUp = async (
    email: string, 
    password: string, 
    userData: {
    full_name?: string
    avatar_url?: string
  }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      })
      
      if (error) throw error
      return data
    } catch (err) {
      console.error('[signUp error]', err)
      throw err
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (err) {
      console.error('[signOut error]', err)
      throw err
    }
  }

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
    } catch (err) {
      console.error('[resetPassword error]', err)
      throw err
    }
  }

  // Update password
  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password
      })
      
      if (error) throw error
    } catch (err) {
      console.error('[updatePassword error]', err)
      throw err
    }
  }

  // Get current user (legacy method for compatibility)
  const getUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    } catch (err) {
      console.error('[getUser error]', err)
      return null
    }
  }

  // Get current session
  const getSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    } catch (err) {
      console.error('[getSession error]', err)
      return null
    }
  }

  // Check if user is authenticated
  const isAuthenticated = computed(() => !!user.value)

  // Get user profile with error handling
  const getUserProfile = async () => {
    if (!user.value) return null
    
    try {
      const { userProfile } = useSupabaseDB()
      return await userProfile.get()
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }
  // Get user role from profiles table (best practice: single source of truth)
  const getUserRole = async () => {
    try {
      if (!user.value) return null

      // Use the 'profiles' table as the canonical user profile/role source
      const email = user.value?.email;
      if (!email) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', email)
        .single();

      const profile = data as { role: string } | null;
      if (error || !profile || typeof profile.role !== 'string') return null;
      return profile.role;
    } catch (err) {
      console.error('[getUserRole error]', err)
      return null
    }
  }

  // Check if user is admin
  const isUserAdmin = async () => {
    const role = await getUserRole()
    return role === 'admin'
  }

  return {
    user: readonly(user),
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    getUser,
    getSession,
    getUserProfile,
    getUserRole,
    isUserAdmin
  }
}
