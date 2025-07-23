import { defineStore } from 'pinia'

export interface Project {
  id: number
  project_name: string
  slug: string
  overview: string
  description: string
  isFavorite: boolean
  live_url?: string
  github_url?: string
  status: string
  category: string
  client?: string
  clientLogo?: string
  featured: boolean
  completionDate?: string
  duration?: string
  teamSize?: number
  createdAt: Date
  updatedAt: Date
  userId: number
  tags?: ProjectTag[]
  images?: ProjectImage[]
  testimonials?: Testimonial[]
}

interface ProjectTag {
  id: number
  tag_name: string
  is_primary: boolean
  color?: string
}

interface ProjectImage {
  id: number
  img_name: string
  img_url: string
  is_thumbnail: boolean
  alt?: string
  caption?: string
  order: number
}

interface Testimonial {
  id: number
  quote: string
  author: string
  position?: string
  company?: string
  avatar?: string
  rating?: number
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  total?: number
  page?: number
  pages?: number
}

interface ProjectsState {
  projects: Project[]
  loading: boolean
  error: string | null
}

export const useProjectsStore = defineStore('projects', {
  state: (): ProjectsState => ({
    projects: [],
    loading: false,
    error: null
  }),

  getters: {
    allProjects: (state) => state.projects,
    projectById: (state) => (id: number) => state.projects.find(p => p.id === id),
    projectsByCategory: (state) => (category: string) => 
      state.projects.filter(p => p.category === category),
    featuredProjects: (state) => state.projects.filter(p => p.featured),
    isLoading: (state) => state.loading,
    hasError: (state) => state.error !== null
  },

  actions: {
    async fetchProjects(page = 1, limit = 10) {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Project[]>>(`/api/prisma/projects?page=${page}&limit=${limit}`)
        if (response.success) {
          this.projects = response.data || []
        } else {
          this.error = response.message || 'Failed to fetch projects'
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch projects'
        console.error('Error fetching projects:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchProject(id: number) {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Project>>(`/api/prisma/projects/${id}`)
        if (response.success) {
          const project = response.data
          const existingIndex = this.projects.findIndex(p => p.id === project.id)
          if (existingIndex >= 0) {
            this.projects[existingIndex] = project
          } else {
            this.projects.push(project)
          }
          return project
        } else {
          this.error = response.message || 'Failed to fetch project'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch project'
        console.error('Error fetching project:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Project>>('/api/prisma/projects', {
          method: 'POST',
          body: projectData
        })
        
        if (response.success) {
          this.projects.unshift(response.data)
          return response.data
        } else {
          this.error = response.message || 'Failed to create project'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to create project'
        console.error('Error creating project:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async updateProject(id: number, projectData: Partial<Project>) {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Project>>(`/api/prisma/projects/${id}`, {
          method: 'PUT',
          body: projectData
        })
        
        if (response.success) {
          const index = this.projects.findIndex(p => p.id === id)
          if (index >= 0) {
            this.projects[index] = response.data
          }
          return response.data
        } else {
          this.error = response.message || 'Failed to update project'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to update project'
        console.error('Error updating project:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async deleteProject(id: number) {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<boolean>>(`/api/prisma/projects/${id}`, {
          method: 'DELETE'
        })
        
        if (response.success) {
          const index = this.projects.findIndex(p => p.id === id)
          if (index >= 0) {
            this.projects.splice(index, 1)
          }
          return true
        } else {
          this.error = response.message || 'Failed to delete project'
          return false
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to delete project'
        console.error('Error deleting project:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    clearError() {
      this.error = null
    }
  }
}) 