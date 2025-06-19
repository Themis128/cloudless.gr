import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
  const user = ref({
    full_name: '',
    avatar_url: '',
    role: '',
    email: '',
  });

  const fetchUserProfile = async () => {
    if (typeof window === 'undefined') return; // prevent SSR error
    console.log('🔍 [UserStore] Starting fetchUserProfile...');

    const supabase = useSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    console.log('🔐 [UserStore] Auth user:', authUser?.id, authUser?.email);

    if (!authUser) {
      console.log('❌ [UserStore] No authenticated user found');
      user.value = { full_name: '', avatar_url: '', role: '', email: '' };
      return;
    }

    // Fetch user info
    console.log('📡 [UserStore] Fetching from user-info table...');
    const { data: userInfo, error: userInfoError } = await supabase
      .from('user-info')
      .select('full_name, avatar_url')
      .eq('id', authUser.id)
      .single();

    console.log('👤 [UserStore] User info result:', { userInfo, userInfoError });

    // Fetch user profile/role
    console.log('📡 [UserStore] Fetching from profiles table...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    console.log('🎭 [UserStore] Profile result:', { profile, profileError });
    if (userInfoError && profileError) {
      console.error('❌ [UserStore] Failed to fetch user data:', { userInfoError, profileError });
      user.value = {
        full_name: 'Themistoklis Baltzakis', // Fallback name
        avatar_url: '',
        role: 'user',
        email: authUser.email ?? '',
      };
    } else {
      const finalUser = {
        full_name: (userInfo as any)?.full_name || 'Themistoklis Baltzakis', // Use fallback if database is empty
        avatar_url: (userInfo as any)?.avatar_url ?? '',
        role: (profile as any)?.role ?? 'user',
        email: authUser.email ?? '',
      };

      console.log('✅ [UserStore] Setting user data:', finalUser);
      user.value = finalUser;
    }
  };

  const isAdmin = () => {
    return user.value.role === 'admin';
  };

  const isUser = () => {
    return user.value.role === 'user';
  };

  const logout = async () => {
    const supabase = useSupabaseClient();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error:', e);
    }
    user.value = { full_name: '', avatar_url: '', role: '', email: '' };
  };

  return { user, fetchUserProfile, isAdmin, isUser, logout };
});
