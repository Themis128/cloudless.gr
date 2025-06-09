import { useSupabaseClient } from '#imports';
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isLoggedIn: false,
    user: null as any,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async initialize() {
      const supabase = useSupabaseClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        this.error = error.message;
        this.isLoggedIn = false;
        this.user = null;
        return;
      }

      if (session) {
        this.isLoggedIn = true;
        this.user = session.user;
      }
    },

    async login(email: string, password: string) {
      const supabase = useSupabaseClient();
      this.loading = true;
      this.error = null;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        this.isLoggedIn = true;
        this.user = data.user;
      } catch (err: any) {
        this.error = err.message;
        this.isLoggedIn = false;
        this.user = null;
      } finally {
        this.loading = false;
      }
    },

    async signup(email: string, password: string) {
      const supabase = useSupabaseClient();
      this.loading = true;
      this.error = null;

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        // User needs to verify email
        this.isLoggedIn = false;
        this.user = data.user;
      } catch (err: any) {
        this.error = err.message;
        this.isLoggedIn = false;
        this.user = null;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      const supabase = useSupabaseClient();
      this.loading = true;
      this.error = null;

      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        this.isLoggedIn = false;
        this.user = null;
      } catch (err: any) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
