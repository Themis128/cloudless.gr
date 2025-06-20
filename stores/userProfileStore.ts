import { defineStore } from 'pinia';

export const useUserProfileStore = defineStore('userProfile', {
  state: () => ({
    userProfile: null as any,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async loadProfile() {
      this.loading = true;
      this.error = null;
      try {
        // Use composable or API to fetch user profile
        const { userProfile } = useSupabaseDB();
        this.userProfile = await userProfile.get();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load user profile';
      } finally {
        this.loading = false;
      }
    },
  },
});
