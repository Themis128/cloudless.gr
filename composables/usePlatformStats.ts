import { ref, useFetch } from '#imports'

export function usePlatformStats() {
  const stats = ref<any>({
    agents: 0,
    workflows: 0,
    memory_usage: 0,
    active_sessions: 0,
    total_executions: 0,
    success_rate: 0,
    uptime_hours: 0,
    storage_used: 0,
    api_calls_today: 0,
    errors_today: 0
  })
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const fetchStats = async () => {
    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await useFetch('/api/dashboard/stats')

      if (fetchError.value) {
        error.value = fetchError.value
        console.error('Error fetching platform stats:', fetchError.value)
      } else if (data.value?.success) {
        stats.value = data.value.data
      } else {
        error.value = new Error(data.value?.error || 'Failed to fetch stats')
      }
    } catch (err) {
      error.value = err as Error
      console.error('Exception fetching platform stats:', err)
    }

    loading.value = false
  }

  return { stats, fetchStats, loading, error }
}
