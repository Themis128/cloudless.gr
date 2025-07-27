import { computed, onMounted } from 'vue'

// Composable that uses the Pinia store
export function useCredlyBadges(username: string) {
  const credlyBadgesStore = useCredlyBadgesStore()

  // Initialize badges on mount
  onMounted(() => {
    if (username) {
      credlyBadgesStore.fetchBadges(username)
    }
  })

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    badges: computed(() => credlyBadgesStore.badges),
    loading: computed(() => credlyBadgesStore.loading),

    // Additional store methods
    fetchBadges: credlyBadgesStore.fetchBadges,
    clearBadges: credlyBadgesStore.clearBadges,
    setError: credlyBadgesStore.setError,
    clearError: credlyBadgesStore.clearError,
    getBadgeById: credlyBadgesStore.getBadgeById,
    getBadgesByIssuer: credlyBadgesStore.getBadgesByIssuer,
    getBadgesByYear: credlyBadgesStore.getBadgesByYear,
    getBadgeStats: credlyBadgesStore.getBadgeStats,

    // Additional computed properties from store
    hasBadges: computed(() => credlyBadgesStore.hasBadges),
    badgeCount: computed(() => credlyBadgesStore.badgeCount),
    recentBadges: computed(() => credlyBadgesStore.recentBadges),
    error: computed(() => credlyBadgesStore.error),
    currentUsername: computed(() => credlyBadgesStore.currentUsername),
  }
}
