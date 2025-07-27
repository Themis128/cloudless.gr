// composable to fetch and manage project data
import { computed } from 'vue'
import type { Project, ProjectCategory, ProjectStatus } from '~/types/projects'

// Composable that uses the Pinia store
export function useProjects() {
  const projectsStore = useProjectsStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    projects: computed(() => projectsStore.allProjects as any),
    isLoading: computed(() => projectsStore.isLoading),
    error: computed(() => projectsStore.error),

    // Computed properties
    featuredProjects: computed(() => projectsStore.featuredProjects as any),
    recentProjects: computed(() => {
      return [...projectsStore.allProjects]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 4)
    }) as any,

    // Methods (delegate to store)
    fetchProjects: projectsStore.fetchProjects,
    fetchProject: projectsStore.fetchProject,
    createProject: projectsStore.createProject,
    updateProject: projectsStore.updateProject,
    deleteProject: projectsStore.deleteProject,
    clearError: projectsStore.clearError,

    // Additional store methods
    projectById: projectsStore.projectById,
    projectsByCategory: projectsStore.projectsByCategory,
    hasError: computed(() => projectsStore.hasError),

    // Legacy methods for backward compatibility
    async fetchProjectBySlug(slug: string): Promise<Project | null> {
      // This would need to be implemented in the store or handled differently
      console.warn('fetchProjectBySlug not implemented in store yet')
      return null
    },

    async toggleFavorite(id: number): Promise<void> {
      try {
        const project = projectsStore.projectById(id)
        if (!project) return

        // Update the project's favorite status
        await projectsStore.updateProject(id, {
          isFavorite: !project.isFavorite,
        })
      } catch (err) {
        console.error('Error toggling favorite status:', err)
        throw err
      }
    },

    getRelatedProjects(project: Project): Project[] {
      if (!project.relatedProjects?.length) {
        return []
      }
      return projectsStore.allProjects.filter(p =>
        project.relatedProjects!.includes(p.id)
      ) as any
    },

    filterByCategory(category: ProjectCategory): Project[] {
      return projectsStore.projectsByCategory(category) as any
    },

    filterByStatus(status: ProjectStatus): Project[] {
      return projectsStore.allProjects.filter(
        project => project.status === status
      ) as any
    },

    searchProjects(query: string): Project[] {
      const lowercaseQuery = query.toLowerCase()
      return projectsStore.allProjects.filter(
        project =>
          project.project_name.toLowerCase().includes(lowercaseQuery) ||
          project.description.toLowerCase().includes(lowercaseQuery) ||
          project.overview.toLowerCase().includes(lowercaseQuery)
      ) as any
    },
  }
}
