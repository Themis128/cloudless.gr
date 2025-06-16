export const useSupabaseAuth = () => {
  const supabase = useSupabaseClient();

  const signIn = async (email: string, password: string, requireAdminRole = false) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // If admin role is required, check the user's role
      if (requireAdminRole && data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile || (profile as any).role !== 'admin') {
          // Sign out the user if they're not an admin
          await supabase.auth.signOut();
          throw new Error('Admin access required');
        }
      }

      return data;
    } catch (err) {
      console.error('[signIn error]', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('[signOut error]', err);
      throw err;
    }
  };

  const getUser = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (err) {
      console.error('[getUser error]', err);
      return null;
    }
  };

  const getUserRole = async () => {
    try {
      const user = await getUser();
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || !profile) return null;
      return (profile as any).role;
    } catch (err) {
      console.error('[getUserRole error]', err);
      return null;
    }
  };

  const isAdmin = async () => {
    const role = await getUserRole();
    return role === 'admin';
  };

  const isAuthenticated = async () => {
    const user = await getUser();
    return !!user;
  };

  return {
    signIn,
    signOut,
    getUser,
    getUserRole,
    isAdmin,
    isAuthenticated,
  };
};
