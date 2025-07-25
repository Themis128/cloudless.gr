import { defineStore } from 'pinia'

// Types
export interface LLMModel {
  id: string
  name: string
  description?: string
  type: 'text-generation' | 'text-classification' | 'translation' | 'summarization' | 'custom'
  status: 'draft' | 'training' | 'ready' | 'deployed' | 'archived' | 'error'
  framework?: string
  version?: string
  config?: any
  metrics?: {
    accuracy?: number
    loss?: number
    precision?: number
    recall?: number
    f1Score?: number
  }
  createdAt: Date
  updatedAt: Date
  userId: string
  projectId?: string
}

export interface TrainingSession {
  id: string
  name: string
  modelId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
  progress: number
  config: {
    epochs: number
    batchSize: number
    learningRate: number
    optimizer: string
    dataset: string
  }
  logs: string[]
  metrics?: {
    currentEpoch: number
    totalEpochs: number
    currentLoss: number
    validationLoss: number
    accuracy: number
  }
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Deployment {
  id: string
  name: string
  modelId: string
  status: 'active' | 'inactive' | 'deploying' | 'error'
  endpoint: string
  config: {
    replicas: number
    resources: {
      cpu: string
      memory: string
    }
    scaling: {
      minReplicas: number
      maxReplicas: number
    }
  }
  metrics?: {
    requestsPerSecond: number
    averageResponseTime: number
    errorRate: number
    cpuUsage: number
    memoryUsage: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface Dataset {
  id: string
  name: string
  description?: string
  type: 'text' | 'image' | 'tabular' | 'audio'
  size: number
  format: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  createdAt: Date
  updatedAt: Date
}

export interface LLMAnalytics {
  models: {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
  }
  training: {
    total: number
    running: number
    completed: number
    failed: number
    averageDuration: number
  }
  deployments: {
    total: number
    active: number
    inactive: number
    totalRequests: number
    averageResponseTime: number
  }
  usage: {
    totalRequests: number
    requestsToday: number
    averageRequestsPerDay: number
    costPerDay: number
  }
}

export interface LLMForm {
  name: string
  description: string
  type: string
  config: any
  hyperparameters: {
    learningRate: number
    batchSize: number
    epochs: number
    optimizer: string
  }
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface LLMState {
  // Core data
  models: LLMModel[]
  trainingSessions: TrainingSession[]
  deployments: Deployment[]
  datasets: Dataset[]
  analytics: LLMAnalytics | null
  
  // Loading states
  loading: {
    models: boolean
    training: boolean
    deployments: boolean
    datasets: boolean
    analytics: boolean
  }
  
  // Error and success states
  error: string | null
  success: string | null
  
  // UI state
  activeTab: string
  selectedModel: LLMModel | null
  selectedTraining: TrainingSession | null
  selectedDeployment: Deployment | null
  
  // Form state
  modelForm: LLMForm
  trainingForm: {
    modelId: string
    name: string
    config: any
  }
  deploymentForm: {
    modelId: string
    name: string
    config: any
  }
  
  // Validation state
  validationErrors: {
    name: string
    description: string
    type: string
    config: string
  }
  
  // Real-time updates
  trainingProgress: Record<string, number>
  deploymentStatus: Record<string, string>
}

export const useLLMStore = defineStore('llm', {
  state: (): LLMState => ({
    // Core data
    models: [],
    trainingSessions: [],
    deployments: [],
    datasets: [],
    analytics: null,
    
    // Loading states
    loading: {
      models: false,
      training: false,
      deployments: false,
      datasets: false,
      analytics: false
    },
    
    // Error and success states
    error: null,
    success: null,
    
    // UI state
    activeTab: 'models',
    selectedModel: null,
    selectedTraining: null,
    selectedDeployment: null,
    
    // Form state
    modelForm: {
      name: '',
      description: '',
      type: 'text-generation',
      config: {},
      hyperparameters: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 10,
        optimizer: 'adam'
      }
    },
    trainingForm: {
      modelId: '',
      name: '',
      config: {}
    },
    deploymentForm: {
      modelId: '',
      name: '',
      config: {}
    },
    
    // Validation state
    validationErrors: {
      name: '',
      description: '',
      type: '',
      config: ''
    },
    
    // Real-time updates
    trainingProgress: {},
    deploymentStatus: {}
  }),

  getters: {
    // Model getters
    readyModels: (state) => state.models.filter(model => model.status === 'ready'),
    trainingModels: (state) => state.models.filter(model => model.status === 'training'),
    deployedModels: (state) => state.models.filter(model => model.status === 'deployed'),
    
    // Training getters
    runningTraining: (state) => state.trainingSessions.filter(session => session.status === 'running'),
    completedTraining: (state) => state.trainingSessions.filter(session => session.status === 'completed'),
    failedTraining: (state) => state.trainingSessions.filter(session => session.status === 'failed'),
    
    // Deployment getters
    activeDeployments: (state) => state.deployments.filter(deployment => deployment.status === 'active'),
    inactiveDeployments: (state) => state.deployments.filter(deployment => deployment.status === 'inactive'),
    
    // Stats getters
    modelStats: (state) => ({
      total: state.models.length,
      ready: state.models.filter(m => m.status === 'ready').length,
      training: state.models.filter(m => m.status === 'training').length,
      deployed: state.models.filter(m => m.status === 'deployed').length
    }),
    
    trainingStats: (state) => ({
      total: state.trainingSessions.length,
      running: state.trainingSessions.filter(t => t.status === 'running').length,
      completed: state.trainingSessions.filter(t => t.status === 'completed').length,
      failed: state.trainingSessions.filter(t => t.status === 'failed').length
    }),
    
    deploymentStats: (state) => ({
      total: state.deployments.length,
      active: state.deployments.filter(d => d.status === 'active').length,
      inactive: state.deployments.filter(d => d.status === 'inactive').length
    }),
    
    // Form validation
    isModelFormValid: (state) => {
      return state.modelForm.name.trim() !== '' && 
             state.modelForm.description.trim() !== '' &&
             state.modelForm.type !== ''
    },
    
    isTrainingFormValid: (state) => {
      return state.trainingForm.modelId !== '' && 
             state.trainingForm.name.trim() !== ''
    },
    
    isDeploymentFormValid: (state) => {
      return state.deploymentForm.modelId !== '' && 
             state.deploymentForm.name.trim() !== ''
    }
  },

  actions: {
    // Model actions
    async fetchModels() {
      this.loading.models = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<LLMModel[]>>('/api/llm/models')
        if (response.success) {
          this.models = response.data
        } else {
          throw new Error(response.message || 'Failed to fetch models')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch models'
        console.error('Error fetching models:', error)
      } finally {
        this.loading.models = false
      }
    },

    async createModel(modelData: Omit<LLMModel, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) {
      this.loading.models = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<LLMModel>>('/api/llm/models', {
          method: 'POST',
          body: modelData
        })
        
        if (response.success) {
          this.models.push(response.data)
          this.success = 'Model created successfully'
          return response.data
        } else {
          throw new Error(response.message || 'Failed to create model')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to create model'
        console.error('Error creating model:', error)
        throw error
      } finally {
        this.loading.models = false
      }
    },

    async updateModel(id: string, modelData: Partial<LLMModel>) {
      this.loading.models = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<LLMModel>>(`/api/llm/models/${id}`, {
          method: 'PUT',
          body: modelData
        })
        
        if (response.success) {
          const index = this.models.findIndex(m => m.id === id)
          if (index !== -1) {
            this.models[index] = response.data
          }
          this.success = 'Model updated successfully'
          return response.data
        } else {
          throw new Error(response.message || 'Failed to update model')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to update model'
        console.error('Error updating model:', error)
        throw error
      } finally {
        this.loading.models = false
      }
    },

    async deleteModel(id: string) {
      this.loading.models = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<void>>(`/api/llm/models/${id}`, {
          method: 'DELETE'
        })
        
        if (response.success) {
          this.models = this.models.filter(m => m.id !== id)
          this.success = 'Model deleted successfully'
        } else {
          throw new Error(response.message || 'Failed to delete model')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to delete model'
        console.error('Error deleting model:', error)
        throw error
      } finally {
        this.loading.models = false
      }
    },

    // Training actions
    async fetchTrainingSessions() {
      this.loading.training = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<TrainingSession[]>>('/api/llm/training')
        if (response.success) {
          this.trainingSessions = response.data
        } else {
          throw new Error(response.message || 'Failed to fetch training sessions')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch training sessions'
        console.error('Error fetching training sessions:', error)
      } finally {
        this.loading.training = false
      }
    },

    async startTraining(trainingData: Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'>) {
      this.loading.training = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<TrainingSession>>('/api/llm/training', {
          method: 'POST',
          body: trainingData
        })
        
        if (response.success) {
          this.trainingSessions.push(response.data)
          this.success = 'Training started successfully'
          return response.data
        } else {
          throw new Error(response.message || 'Failed to start training')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to start training'
        console.error('Error starting training:', error)
        throw error
      } finally {
        this.loading.training = false
      }
    },

    async stopTraining(id: string) {
      this.loading.training = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<TrainingSession>>(`/api/llm/training/${id}/stop`, {
          method: 'POST'
        })
        
        if (response.success) {
          const index = this.trainingSessions.findIndex(t => t.id === id)
          if (index !== -1) {
            this.trainingSessions[index] = response.data
          }
          this.success = 'Training stopped successfully'
          return response.data
        } else {
          throw new Error(response.message || 'Failed to stop training')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to stop training'
        console.error('Error stopping training:', error)
        throw error
      } finally {
        this.loading.training = false
      }
    },

    // Deployment actions
    async fetchDeployments() {
      this.loading.deployments = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Deployment[]>>('/api/llm/deployments')
        if (response.success) {
          this.deployments = response.data
        } else {
          throw new Error(response.message || 'Failed to fetch deployments')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch deployments'
        console.error('Error fetching deployments:', error)
      } finally {
        this.loading.deployments = false
      }
    },

    async createDeployment(deploymentData: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>) {
      this.loading.deployments = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Deployment>>('/api/llm/deployments', {
          method: 'POST',
          body: deploymentData
        })
        
        if (response.success) {
          this.deployments.push(response.data)
          this.success = 'Deployment created successfully'
          return response.data
        } else {
          throw new Error(response.message || 'Failed to create deployment')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to create deployment'
        console.error('Error creating deployment:', error)
        throw error
      } finally {
        this.loading.deployments = false
      }
    },

    async startDeployment(id: string) {
      this.loading.deployments = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Deployment>>(`/api/llm/deployments/${id}/start`, {
          method: 'POST'
        })
        
        if (response.success) {
          const index = this.deployments.findIndex(d => d.id === id)
          if (index !== -1) {
            this.deployments[index] = response.data
          }
          this.success = 'Deployment started successfully'
          return response.data
        } else {
          throw new Error(response.message || 'Failed to start deployment')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to start deployment'
        console.error('Error starting deployment:', error)
        throw error
      } finally {
        this.loading.deployments = false
      }
    },

    async stopDeployment(id: string) {
      this.loading.deployments = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Deployment>>(`/api/llm/deployments/${id}/stop`, {
          method: 'POST'
        })
        
        if (response.success) {
          const index = this.deployments.findIndex(d => d.id === id)
          if (index !== -1) {
            this.deployments[index] = response.data
          }
          this.success = 'Deployment stopped successfully'
          return response.data
        } else {
          throw new Error(response.message || 'Failed to stop deployment')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to stop deployment'
        console.error('Error stopping deployment:', error)
        throw error
      } finally {
        this.loading.deployments = false
      }
    },

    // Analytics actions
    async fetchAnalytics() {
      this.loading.analytics = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<LLMAnalytics>>('/api/llm/analytics')
        if (response.success) {
          this.analytics = response.data
        } else {
          throw new Error(response.message || 'Failed to fetch analytics')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch analytics'
        console.error('Error fetching analytics:', error)
      } finally {
        this.loading.analytics = false
      }
    },

    // Dataset actions
    async fetchDatasets() {
      this.loading.datasets = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Dataset[]>>('/api/llm/datasets')
        if (response.success) {
          this.datasets = response.data
        } else {
          throw new Error(response.message || 'Failed to fetch datasets')
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch datasets'
        console.error('Error fetching datasets:', error)
      } finally {
        this.loading.datasets = false
      }
    },

    // UI actions
    setActiveTab(tab: string) {
      this.activeTab = tab
    },

    selectModel(model: LLMModel | null) {
      this.selectedModel = model
    },

    selectTraining(training: TrainingSession | null) {
      this.selectedTraining = training
    },

    selectDeployment(deployment: Deployment | null) {
      this.selectedDeployment = deployment
    },

    // Form actions
    updateModelForm(field: keyof LLMForm, value: any) {
      this.modelForm[field] = value
      this.clearValidationError(field)
    },

    updateTrainingForm(field: keyof typeof this.trainingForm, value: any) {
      this.trainingForm[field] = value
    },

    updateDeploymentForm(field: keyof typeof this.deploymentForm, value: any) {
      this.deploymentForm[field] = value
    },

    resetModelForm() {
      this.modelForm = {
        name: '',
        description: '',
        type: 'text-generation',
        config: {},
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 10,
          optimizer: 'adam'
        }
      }
      this.clearAllValidationErrors()
    },

    resetTrainingForm() {
      this.trainingForm = {
        modelId: '',
        name: '',
        config: {}
      }
    },

    resetDeploymentForm() {
      this.deploymentForm = {
        modelId: '',
        name: '',
        config: {}
      }
    },

    // Validation actions
    validateField(field: keyof LLMForm) {
      const value = this.modelForm[field]
      
      switch (field) {
        case 'name':
          this.validationErrors.name = value.trim() === '' ? 'Name is required' : ''
          break
        case 'description':
          this.validationErrors.description = value.trim() === '' ? 'Description is required' : ''
          break
        case 'type':
          this.validationErrors.type = value === '' ? 'Type is required' : ''
          break
        case 'config':
          this.validationErrors.config = !value || Object.keys(value).length === 0 ? 'Configuration is required' : ''
          break
      }
    },

    validateAllFields() {
      this.validateField('name')
      this.validateField('description')
      this.validateField('type')
      this.validateField('config')
      
      return !Object.values(this.validationErrors).some(error => error !== '')
    },

    clearValidationError(field: keyof LLMForm) {
      this.validationErrors[field] = ''
    },

    clearAllValidationErrors() {
      this.validationErrors = {
        name: '',
        description: '',
        type: '',
        config: ''
      }
    },

    // Real-time updates
    updateTrainingProgress(sessionId: string, progress: number) {
      this.trainingProgress[sessionId] = progress
      
      const session = this.trainingSessions.find(s => s.id === sessionId)
      if (session) {
        session.progress = progress
        if (progress >= 100) {
          session.status = 'completed'
          session.completedAt = new Date()
        }
      }
    },

    updateDeploymentStatus(deploymentId: string, status: string) {
      this.deploymentStatus[deploymentId] = status
      
      const deployment = this.deployments.find(d => d.id === deploymentId)
      if (deployment) {
        deployment.status = status as any
      }
    },

    // Utility actions
    clearError() {
      this.error = null
    },

    clearSuccess() {
      this.success = null
    },

    // Initialize store
    async initialize() {
      await Promise.all([
        this.fetchModels(),
        this.fetchTrainingSessions(),
        this.fetchDeployments(),
        this.fetchAnalytics(),
        this.fetchDatasets()
      ])
    }
  }
}) 