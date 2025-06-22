import { defineStore } from 'pinia';
import type { Database } from '~/types/supabase';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

export const useUserProfileStore = defineStore('userProfile', {
  state: () => ({
    userProfile: null as UserProfile | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async loadProfile() {
      this.loading = true;
      this.error = null;
      try {        // Get user profile from Supabase
        const supabase = useSupabaseClient<Database>();
        const user = useSupabaseUser();
        
        if (!user.value) {
          throw new Error('User not authenticated');
        }
          const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.value.id)
          .single();
          
        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
          throw error;
        }
          this.userProfile = data || null;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load user profile';
        console.error('Error loading user profile:', err);
      } finally {
        this.loading = false;
      }
    },
    
    async updateProfile(profileData: Partial<UserProfile>) {
      this.loading = true;
      this.error = null;
      try {        const supabase = useSupabaseClient<Database>();
        const user = useSupabaseUser();
        
        if (!user.value) {
          throw new Error('User not authenticated');
        }
        
        const { data, error } = await supabase
          .from('profiles')
          .update({
            ...profileData,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.value.id)
          .select()
          .single();
          
        if (error) {
          throw error;
        }
        
        this.userProfile = data;
        return data;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to update user profile';
        console.error('Error updating user profile:', err);
        throw err;
      } finally {
        this.loading = false;
      }
    }
  },
});
