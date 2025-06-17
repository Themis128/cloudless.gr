/**
 * Composable for fetching and managing projects list
 */
import { ref, computed } from 'vue'
import type { Project } from '~/types/project'

export const useFetchProjects = () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // Supabase client
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  // Fetch all projects for the current user
  const fetchProjects = async () => {
    if (!user.value) {
      throw new Error('User not authenticated')
    }

    try {
      loading.value = true
      error.value = null

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select(`
          *,
          pipelines (
            id,
            config
          ),
          training_jobs (
            id,
            status,
            created_at
          ),
          model_versions (
            id,
            version_tag,
            deployed,
            endpoint_url
          )
        `)
        .eq('owner_id', user.value.id)
        .order('updated_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      projects.value = data || []
    } catch (err) {
      error.value = err as Error
      console.error('Failed to fetch projects:', err)
    } finally {
      loading.value = false
    }
  }

  // Delete a project
  const deleteProject = async (projectId: string) => {
    if (!user.value) {
      throw new Error('User not authenticated')
    }

    try {
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('owner_id', user.value.id)

      if (deleteError) {
        throw deleteError
      }

      // Remove from local state
      projects.value = projects.value.filter(p => p.id !== projectId)
    } catch (err) {
      console.error('Failed to delete project:', err)
      throw err
    }
  }

  // Get project by ID
  const getProject = (projectId: string) => {
    return computed(() => 
      projects.value.find(p => p.id === projectId)
    )
  }

  // Filter projects by status
  const getProjectsByStatus = (status: string) => {
    return computed(() => 
      projects.value.filter(p => p.status === status)
    )
  }

  // Get project statistics
  const projectStats = computed(() => {
    const stats = {
      total: projects.value.length,
      active: 0,
      training: 0,
      deployed: 0,
      completed: 0,
      draft: 0,
      error: 0
    }

    projects.value.forEach(project => {
      if (project.status in stats) {
        stats[project.status as keyof typeof stats]++
      }
    })

    return stats
  })

  return {
    projects: readonly(projects),
    loading: readonly(loading),
    error: readonly(error),
    projectStats,
    fetchProjects,
    deleteProject,
    getProject,
    getProjectsByStatus
  }
}
