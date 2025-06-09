import type { User } from '@supabase/supabase-js';
import type { AuthState } from '~/types/auth';
import type { Database } from '~/utils/supabase';

export const useSupabaseAuth = () => {
  const client = useSupabaseClient<Database>();

  // Use reactive state
  const state = ref<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: false,
    error: null,
    success: null,
    socialLoading: null,
  });

  const user = useSupabaseUser();

  // Get user profile with role
  const fetchUserProfile = async () => {
    if (!user.value) return null;

    try {
      const { data, error: err } = await client
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.value.id)
        .single();

      if (err) throw err;
      state.value.profile = data;
      return data;
    } catch (err: any) {
      console.error('Error fetching user profile:', err.message);
      state.value.error = {
        message: err.message,
        type: 'network',
      };
      return null;
    }
  };

  // Send verification email
  const sendVerificationEmail = async (email: string) => {
    state.value.loading = true;
    state.value.error = null;

    try {
      const { error: err } = await client.auth.resend({
        type: 'signup',
        email,
      });

      if (err) throw err;
      state.value.success = 'Verification email sent successfully';
      return true;
    } catch (err: any) {
      console.error('Error sending verification email:', err.message);
      state.value.error = {
        message: err.message,
        type: 'auth',
      };
      throw err;
    } finally {
      state.value.loading = false;
    }
  };

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    state.value.loading = true;
    state.value.error = null;

    try {
      // First check if email is verified
      const { data: profileData, error: profileErr } = await client
        .from('user_profiles')
        .select('email_verified')
        .eq('email', email)
        .single();

      if (profileErr) {
        if (profileErr.code === 'PGRST116') {
          // Profile not found - proceed with sign in and create profile later
          console.log('No profile found, will create after sign in');
        } else {
          throw profileErr;
        }
      } else if (profileData && !profileData.email_verified) {
        throw new Error(
          'Please verify your email before signing in. Check your inbox or request a new verification email.'
        );
      }

      const { data: authData, error: signInErr } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) throw signInErr;

      // After successful login, fetch or create user profile
      let profile = await fetchUserProfile();

      if (!profile) {
        // Create profile if it doesn't exist
        const { data: newProfile, error: createErr } = await client
          .from('user_profiles')
          .insert({
            user_id: authData.user.id,
            email: authData.user.email,
            email_verified: authData.user.email_confirmed_at ? true : false,
            role: 'user',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createErr) throw createErr;
        profile = newProfile;
        state.value.profile = newProfile;
      }

      state.value.user = authData.user;
      state.value.success = 'Successfully signed in!';
      return { user: authData.user, profile };
    } catch (err: any) {
      state.value.error = {
        message: err.message,
        type: 'auth',
      };
      throw err;
    } finally {
      state.value.loading = false;
    }
  };

  // Sign in with OAuth provider
  const signInWithOAuth = async ({ provider }: { provider: 'google' | 'github' }) => {
    state.value.loading = true;
    state.value.error = null;
    state.value.socialLoading = provider;

    try {
      const { data, error: err } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (err) throw err;
      return data;
    } catch (err: any) {
      console.error('OAuth error:', err.message);
      state.value.error = {
        message: err.message,
        type: 'auth',
        provider,
      };
      throw err;
    } finally {
      state.value.loading = false;
      state.value.socialLoading = null;
    }
  };

  // Sign up new user
  const signUp = async (email: string, password: string, metadata: any = {}) => {
    state.value.loading = true;
    state.value.error = null;

    try {
      const { error: err } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            ...metadata,
            username: email.split('@')[0],
            full_name: metadata.full_name || '',
          },
        },
      });

      if (err) throw err;
      state.value.success = 'Account created! Please check your email for verification.';
      return true;
    } catch (err: any) {
      state.value.error = {
        message: err.message,
        type: 'auth',
      };
      throw err;
    } finally {
      state.value.loading = false;
    }
  };

  // Sign out
  const signOut = async () => {
    state.value.loading = true;
    state.value.error = null;

    try {
      const { error: err } = await client.auth.signOut();
      if (err) throw err;
      state.value.profile = null;
      state.value.user = null;
      state.value.session = null;
      state.value.success = 'Successfully signed out';
    } catch (err: any) {
      state.value.error = {
        message: err.message,
        type: 'auth',
      };
      throw err;
    } finally {
      state.value.loading = false;
    }
  };

  // Password reset request
  const resetPasswordRequest = async (email: string) => {
    state.value.loading = true;
    state.value.error = null;

    try {
      const { error: err } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (err) throw err;
      state.value.success = 'Password reset email sent! Please check your inbox.';
      return true;
    } catch (err: any) {
      state.value.error = {
        message: err.message,
        type: 'auth',
      };
      return false;
    } finally {
      state.value.loading = false;
    }
  };

  // Update password
  const updatePassword = async (newPassword: string) => {
    state.value.loading = true;
    state.value.error = null;

    try {
      const { error: err } = await client.auth.updateUser({
        password: newPassword,
      });
      if (err) throw err;
      state.value.success = 'Password updated successfully';
      return true;
    } catch (err: any) {
      state.value.error = {
        message: err.message,
        type: 'auth',
      };
      return false;
    } finally {
      state.value.loading = false;
    }
  };

  // Get current session
  const getSession = async () => {
    const {
      data: { session: currentSession },
      error: err,
    } = await client.auth.getSession();

    if (err) {
      state.value.error = {
        message: err.message,
        type: 'auth',
      };
      return null;
    }

    state.value.session = currentSession;
    return currentSession;
  };

  // Role checking helpers
  const isAdmin = computed(() => state.value.profile?.role === 'admin');
  const isUser = computed(() => state.value.profile?.role === 'user');
  const isVerified = computed(() => state.value.user?.email_confirmed_at != null);

  // Initialize
  onMounted(async () => {
    await getSession();
    if (user.value) {
      await fetchUserProfile();
    }
  });

  // Watch for user changes
  watch(user, async (newUser: User | null) => {
    if (newUser) {
      await fetchUserProfile();
    } else {
      state.value.profile = null;
      state.value.session = null;
    }
  });

  // Return composable interface
  return {
    // State
    loading: computed(() => state.value.loading),
    error: computed(() => state.value.error),
    success: computed(() => state.value.success),
    user: computed(() => state.value.user),
    profile: computed(() => state.value.profile),
    session: computed(() => state.value.session),
    socialLoading: computed(() => state.value.socialLoading),

    // Status flags
    isAdmin,
    isUser,
    isVerified,

    // Methods
    signIn,
    signInWithOAuth,
    signUp,
    signOut,
    resetPasswordRequest,
    updatePassword,
    sendVerificationEmail,
    fetchUserProfile,
    getSession,
  };
};
