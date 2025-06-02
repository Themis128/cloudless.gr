export interface CredlyBadge {
  id: string;
  name: string;
  description: string;
  image_url: string;
  issued_at: string;
  expires_at?: string;
  badge_template: {
    name: string;
    image_url: string;
  };
  issuer: {
    name: string;
    image_url: string;
  };
}

export const useCredlyBadges = () => {
  const badges = ref<CredlyBadge[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchBadges = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: boolean;
        data: CredlyBadge[];
      }>('/api/credly-badges');

      if (response.success) {
        badges.value = response.data;
      } else {
        throw new Error('Failed to fetch badges');
      }
    } catch (err: any) {
      console.error('Error fetching Credly badges:', err);
      error.value = err.message || 'Failed to load badges';
      badges.value = [];
    } finally {
      loading.value = false;
    }
  };

  const refreshBadges = () => {
    return fetchBadges();
  };

  // Auto-fetch on composable creation
  fetchBadges();

  return {
    badges: readonly(badges),
    loading: readonly(loading),
    error: readonly(error),
    fetchBadges,
    refreshBadges,
  };
};
