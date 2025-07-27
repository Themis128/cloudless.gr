import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface CredlyBadge {
  id: string
  name: string
  description: string
  image_url: string
  issued_at: string
  issuer: {
    name: string
    url: string
  }
  [key: string]: any
}

export const useCredlyBadgesStore = defineStore('credlyBadges', () => {
  // State
  const badges = ref<CredlyBadge[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentUsername = ref<string | null>(null)

  // Computed properties
  const hasBadges = computed(() => badges.value.length > 0)
  const badgeCount = computed(() => badges.value.length)
  const recentBadges = computed(() =>
    badges.value
      .sort(
        (a, b) =>
          new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
      )
      .slice(0, 5)
  )

  // Actions
  const fetchBadges = async (username: string) => {
    if (!username) {
      error.value = 'Username is required'
      return
    }

    loading.value = true
    error.value = null
    currentUsername.value = username

    try {
      const response = await fetch(
        `https://www.credly.com/users/${username}/badges.json`
      )
      const data = await response.json()

      if (data.data) {
        badges.value = data.data
      } else {
        badges.value = []
        error.value = 'No badges found'
      }
    } catch (e) {
      badges.value = []
      error.value = 'Failed to fetch badges'
      console.error('Error fetching Credly badges:', e)
    } finally {
      loading.value = false
    }
  }

  const clearBadges = () => {
    badges.value = []
    error.value = null
    currentUsername.value = null
  }

  const setError = (errorMessage: string) => {
    error.value = errorMessage
  }

  const clearError = () => {
    error.value = null
  }

  const getBadgeById = (id: string) => {
    return badges.value.find(badge => badge.id === id)
  }

  const getBadgesByIssuer = (issuerName: string) => {
    return badges.value.filter(badge =>
      badge.issuer.name.toLowerCase().includes(issuerName.toLowerCase())
    )
  }

  const getBadgesByYear = (year: number) => {
    return badges.value.filter(badge => {
      const badgeYear = new Date(badge.issued_at).getFullYear()
      return badgeYear === year
    })
  }

  const getBadgeStats = () => {
    const issuers = new Set(badges.value.map(badge => badge.issuer.name))
    const years = new Set(
      badges.value.map(badge => new Date(badge.issued_at).getFullYear())
    )

    return {
      totalBadges: badges.value.length,
      uniqueIssuers: issuers.size,
      yearsActive: years.size,
      oldestBadge:
        badges.value.length > 0
          ? badges.value.reduce((oldest, current) =>
              new Date(current.issued_at) < new Date(oldest.issued_at)
                ? current
                : oldest
            )
          : null,
      newestBadge:
        badges.value.length > 0
          ? badges.value.reduce((newest, current) =>
              new Date(current.issued_at) > new Date(newest.issued_at)
                ? current
                : newest
            )
          : null,
    }
  }

  return {
    // State
    badges,
    loading,
    error,
    currentUsername,

    // Computed
    hasBadges,
    badgeCount,
    recentBadges,

    // Actions
    fetchBadges,
    clearBadges,
    setError,
    clearError,
    getBadgeById,
    getBadgesByIssuer,
    getBadgesByYear,
    getBadgeStats,
  }
})
