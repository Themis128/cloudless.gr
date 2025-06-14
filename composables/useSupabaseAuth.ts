export const useSupabaseAuth = () => {
  const { $supabase } = useNuxtApp();

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await $supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('[signIn error]', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await $supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('[signOut error]', err);
      throw err;
    }
  };

  const getUser = async () => {
    try {
      const { data, error } = await $supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (err) {
      console.error('[getUser error]', err);
      return null;
    }
  };

  return {
    signIn,
    signOut,
    getUser,
  };
};
