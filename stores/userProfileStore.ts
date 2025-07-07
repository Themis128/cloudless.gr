import { defineStore } from 'pinia';
import { getSupabaseClient } from '~/composables/useSupabase'
import { useSupabaseUser } from '#imports'
import { resilientSupabaseCall } from '~/utils/resilientApi'
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
      try {        
        console.log('📊 Loading user profile with resilient API...');
        
        // Get user profile from Supabase with retry logic
        const supabase = getSupabaseClient();
        const user = useSupabaseUser();
        
        if (!user.value) {
          throw new Error('User not authenticated');
        }
        
        const profile = await resilientSupabaseCall(
          async () => {
            return await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.value!.id)
              .single();
          },
          'Load user profile'
        );
        
        this.userProfile = profile || null;
        console.log('✅ User profile loaded successfully:', !!profile);
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load user profile';
        console.error('❌ Error loading user profile:', err);
      } finally {
        this.loading = false;
      }
    },
    
    async updateProfile(profileData: Partial<UserProfile>): Promise<UserProfile | null> {
      this.loading = true;
      this.error = null;
      try {
        console.log('📝 Updating user profile with resilient API...');
        
        const supabase = getSupabaseClient() as import('@supabase/supabase-js').SupabaseClient<Database>;
        const user = useSupabaseUser();
        
        if (!user.value) {
          throw new Error('User not authenticated');
        }
        
        const updatedProfile = await resilientSupabaseCall(
          async () => {
            return await supabase
              .from('profiles')
              .update({
                ...profileData,
                updated_at: new Date().toISOString()
              })
              .eq('id', user.value!.id)
              .select('*')
              .single();
          },
          'Update user profile'
        );
        
        if (!updatedProfile) {
          throw new Error('Failed to update profile');
        }
        
        this.userProfile = updatedProfile;
        console.log('✅ User profile updated successfully');
        return this.userProfile;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to update user profile';
        console.error('❌ Error updating user profile:', err);
        throw err;
      } finally {
        this.loading = false;
      }
    }
  },
});
