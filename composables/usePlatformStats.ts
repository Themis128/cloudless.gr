import { ref, useFetch } from '#imports'

export function usePlatformStats() {
  const stats = ref<any>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const fetchStats = async () => {
    loading.value = true
    error.value = null

    const { data, error: fetchError } = await useFetch('/api/dashboard/stats')

    if (fetchError.value) {
      error.value = fetchError.value
    } else {
      stats.value = data.value
    }

    loading.value = false
  }

  return { stats, fetchStats, loading, error }
}
