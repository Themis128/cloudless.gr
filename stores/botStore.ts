import { defineStore } from 'pinia'

export interface Bot {
  id: number
  name: string
  description: string
  status: 'active' | 'inactive' | 'training'
  model_id?: number
  pipeline_id?: number
  config: any
  createdAt: Date
  updatedAt: Date
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface BotState {
  bots: Bot[]
  loading: boolean
  error: string | null
  success: string | null
}

export const useBotStore = defineStore('bot', {
  state: (): BotState => ({
    bots: [],
    loading: false,
    error: null,
    success: null
  }),

  getters: {
    allBots: (state) => state.bots,
    botById: (state) => (id: number) => state.bots.find(b => b.id === id),
    activeBots: (state) => state.bots.filter(b => b.status === 'active'),
    isLoading: (state) => state.loading,
    hasError: (state) => state.error !== null,
    hasSuccess: (state) => state.success !== null
  },

  actions: {
    async fetchAll() {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Bot[]>>('/api/prisma/bots')
        if (response.success) {
          this.bots = response.data || []
        } else {
          this.error = response.message || 'Failed to fetch bots'
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch bots'
        console.error('Error fetching bots:', error)
      } finally {
        this.loading = false
      }
    },

    async createBot(botData: Omit<Bot, 'id' | 'createdAt' | 'updatedAt'>) {
      this.loading = true
      this.error = null
      this.success = null
      
      try {
        const response = await $fetch<ApiResponse<Bot>>('/api/prisma/bots', {
          method: 'POST',
          body: botData
        })
        
        if (response.success) {
          this.bots.unshift(response.data)
          this.success = 'Bot created successfully'
          return response.data
        } else {
          this.error = response.message || 'Failed to create bot'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to create bot'
        console.error('Error creating bot:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async updateBot(id: number, botData: Partial<Bot>) {
      this.loading = true
      this.error = null
      this.success = null
      
      try {
        const response = await $fetch<ApiResponse<Bot>>(`/api/prisma/bots/${id}`, {
          method: 'PUT',
          body: botData
        })
        
        if (response.success) {
          const index = this.bots.findIndex(b => b.id === id)
          if (index >= 0) {
            this.bots[index] = response.data
          }
          this.success = 'Bot updated successfully'
          return response.data
        } else {
          this.error = response.message || 'Failed to update bot'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to update bot'
        console.error('Error updating bot:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async deleteBot(id: number) {
      this.loading = true
      this.error = null
      this.success = null
      
      try {
        const response = await $fetch<ApiResponse<boolean>>(`/api/prisma/bots/${id}`, {
          method: 'DELETE'
        })
        
        if (response.success) {
          const index = this.bots.findIndex(b => b.id === id)
          if (index >= 0) {
            this.bots.splice(index, 1)
          }
          this.success = 'Bot deleted successfully'
          return true
        } else {
          this.error = response.message || 'Failed to delete bot'
          return false
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to delete bot'
        console.error('Error deleting bot:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    clearError() {
      this.error = null
    },

    clearSuccess() {
      this.success = null
    }
  }
}) 