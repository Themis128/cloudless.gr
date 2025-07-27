import { defineStore } from 'pinia'

export interface Dataset {
  id: string
  name: string
  description?: string
  type: string
  status: string
  size: number
  format: string
  samples?: number
  createdAt: Date
  updatedAt: Date
  userId?: number
}

export interface DatasetForm {
  name: string
  description: string
  type: string
  format: string
  file?: File
}

interface DatasetState {
  datasets: Dataset[]
  loading: boolean
  error: string | null
  success: string | null
  uploading: boolean
}

export const useDatasetStore = defineStore('dataset', {
  state: (): DatasetState => ({
    datasets: [],
    loading: false,
    error: null,
    success: null,
    uploading: false
  }),

  getters: {
    allDatasets: (state) => state.datasets,
    datasetById: (state) => (id: string) => state.datasets.find(d => d.id === id),
    datasetsByStatus: (state) => (status: string) => state.datasets.filter(d => d.status === status),
    readyDatasets: (state) => state.datasets.filter(d => d.status === 'ready'),
    processingDatasets: (state) => state.datasets.filter(d => d.status === 'processing'),
    totalSize: (state) => {
      const total = state.datasets.reduce((acc, dataset) => acc + dataset.size, 0)
      return formatFileSize(total)
    }
  },

  actions: {
    async fetchDatasets() {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch('/api/llm/datasets')
        const responseData = response as any
        if (responseData.success) {
          this.datasets = responseData.data.map((dataset: any) => ({
            ...dataset,
            createdAt: new Date(dataset.createdAt),
            updatedAt: new Date(dataset.updatedAt)
          }))
        } else {
          throw new Error(responseData.message || 'Failed to fetch datasets')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch datasets'
        console.error('Error fetching datasets:', error)
      } finally {
        this.loading = false
      }
    },

    async createDataset(form: DatasetForm) {
      this.uploading = true
      this.error = null
      
      try {
        const formData = new FormData()
        formData.append('name', form.name)
        formData.append('description', form.description)
        formData.append('type', form.type)
        formData.append('format', form.format)
        if (form.file) {
          formData.append('file', form.file)
        }

        const response = await $fetch('/api/llm/datasets', {
          method: 'POST',
          body: formData
        })

        const responseData = response as any
        if (responseData.success) {
          const newDataset = {
            ...responseData.data,
            createdAt: new Date(responseData.data.createdAt),
            updatedAt: new Date(responseData.data.updatedAt)
          }
          this.datasets.unshift(newDataset)
          this.success = 'Dataset created successfully'
          return newDataset
        } else {
          throw new Error(responseData.message || 'Failed to create dataset')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to create dataset'
        console.error('Error creating dataset:', error)
        throw error
      } finally {
        this.uploading = false
      }
    },

    async deleteDataset(id: string) {
      try {
        const response = await $fetch(`/api/llm/datasets/${id}`, {
          method: 'DELETE'
        })

        const responseData = response as any
        if (responseData.success) {
          this.datasets = this.datasets.filter(d => d.id !== id)
          this.success = 'Dataset deleted successfully'
        } else {
          throw new Error(responseData.message || 'Failed to delete dataset')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to delete dataset'
        console.error('Error deleting dataset:', error)
        throw error
      }
    },

    async downloadDataset(id: string) {
      try {
        const response = await $fetch(`/api/llm/datasets/${id}/download`, {
          method: 'GET'
        })
        return response
      } catch (error: any) {
        this.error = error.message || 'Failed to download dataset'
        console.error('Error downloading dataset:', error)
        throw error
      }
    },

    clearMessages() {
      this.error = null
      this.success = null
    }
  }
})

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
} 