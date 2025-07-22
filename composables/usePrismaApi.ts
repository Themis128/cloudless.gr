import type { 
  Project, 
  Profile, 
  TrainingSession, 
  Todo,
  ProjectType,
  ProjectStatus,
  TrainingStatus 
} from '~/generated/prisma'
import { useNuxtApp } from 'nuxt/app'

interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pages: number
}

export const usePrismaApi = () => {
  const { $fetch } = useNuxtApp()

  // Helper function for API calls with error handling
  const apiCall = async <T>(url: string, options?: any): Promise<T> => {
    try {
      const response = await ($fetch as any)(url, options) as ApiResponse<T>
      if (!response.success) {
        throw new Error(response.message || 'API call failed')
      }
      return response.data
    } catch (error: any) {
      console.error(`API call failed for ${url}:`, error)
      throw error
    }
  }

  // Health Check
  const checkHealth = () => {
    return apiCall<{ status: string; timestamp: Date }>('/api/prisma/health')
  }

  // Projects API
  const projects = {
    async list(ownerId?: string, page = 1, limit = 10) {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      if (ownerId) params.append('ownerId', ownerId)
      
      return apiCall<PaginatedResponse<Project & { owner?: Profile }>>(`/api/prisma/projects?${params}`)
    },

    async get(id: string) {
      return apiCall<Project & { 
        owner?: Profile
        collaborators?: any[]
        training_sessions?: TrainingSession[]
        _count?: any
      }>(`/api/prisma/projects/${id}`)
    },

    async create(data: {
      name: string
      description?: string
      type?: ProjectType
      framework?: string
      owner_id: string
      config?: any
    }) {
      return apiCall<Project>('/api/prisma/projects', {
        method: 'POST',
        body: data
      })
    },

    async update(id: string, data: Partial<{
      name: string
      description: string
      type: ProjectType
      status: ProjectStatus
      config: any
    }>) {
      return apiCall<Project>(`/api/prisma/projects/${id}`, {
        method: 'PUT',
        body: data
      })
    },

    async delete(id: string) {
      return apiCall<{ deleted: boolean }>(`/api/prisma/projects/${id}`, {
        method: 'DELETE'
      })
    }
  }

  // Training API
  const training = {
    async create(data: {
      name: string
      projectId?: string
      config?: {
        epochs?: number
        batchSize?: number
        learningRate?: number
        baseModel: string
      }
    }) {
      return apiCall<TrainingSession>('/api/prisma/training', {
        method: 'POST',
        body: data
      })
    },

    async list(projectId?: string, page = 1, limit = 10) {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      if (projectId) params.append('projectId', projectId)
      
      return apiCall<PaginatedResponse<TrainingSession & { project?: Project }>>(`/api/prisma/training?${params}`)
    },

    async get(id: string) {
      return apiCall<TrainingSession & { 
        project?: Project
        model_versions?: any[]
      }>(`/api/prisma/training/${id}`)
    }
  }

  // Users API
  const users = {
    async listProfiles(page = 1, limit = 10) {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      
      return apiCall<PaginatedResponse<Partial<Profile>>>(`/api/prisma/users/profiles?${params}`)
    },

    async getProfile(id: string) {
      return apiCall<Profile & { 
        owned_projects?: Project[]
        project_collaborations?: any[]
      }>(`/api/prisma/users/profiles/${id}`)
    }
  }

  // Todos API (simple example)
  const todos = {
    async list() {
      return apiCall<Todo[]>('/api/prisma/todos')
    },

    async create(title: string) {
      return apiCall<Todo>('/api/prisma/todos', {
        method: 'POST',
        body: { title }
      })
    },

    async update(id: string, data: { title?: string; is_complete?: boolean }) {
      return apiCall<Todo>(`/api/prisma/todos/${id}`, {
        method: 'PUT',
        body: data
      })
    },

    async delete(id: string) {
      return apiCall<{ deleted: boolean }>(`/api/prisma/todos/${id}`, {
        method: 'DELETE'
      })
    }
  }

  return {
    checkHealth,
    projects,
    training,
    users,
    todos
  }
}