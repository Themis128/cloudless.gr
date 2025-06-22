// Composable to fetch and manage project data for user profile
import { computed, ref } from 'vue'

export interface ProjectSummary {
  id: string
  name: string
  description?: string | null
  status: string
  type?: string
  created_at?: string
  updated_at?: string
  owner_id?: string
}

export function useFetchProjects() {
  const projects = ref<ProjectSummary[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const fetchProjects = async () => {
    try {
      isLoading.value = true
      error.value = null

      // Use Supabase to fetch projects for the current user
      const supabase = useSupabaseClient()
      const user = useSupabaseUser()

      if (!user.value) {
        throw new Error('User not authenticated')
      }

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, description, status, type, created_at, updated_at, owner_id')
        .eq('owner_id', user.value.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      projects.value = data || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch projects'
      console.error('Error fetching projects:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Computed properties for project statistics
  const projectStats = computed(() => {
    const stats = {
      total: projects.value.length,
      active: 0,
      draft: 0,
      completed: 0,
      failed: 0,
    }

    projects.value.forEach((project) => {
      switch (project.status) {
        case 'active':
        case 'running':
        case 'training':
          stats.active++
          break
        case 'draft':
        case 'created':
          stats.draft++
          break
        case 'completed':
        case 'deployed':
          stats.completed++
          break
        case 'failed':
        case 'error':
          stats.failed++
          break
      }
    })

    return stats
  })

  const recentProjects = computed(() => {
    return projects.value.slice(0, 5)
  })

  return {
    // State
    projects: computed(() => projects.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    
    // Computed
    projectStats,
    recentProjects,
    
    // Methods
    fetchProjects,
  }
}
