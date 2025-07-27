import { defineStore } from 'pinia'

export interface Model {
  id: number
  name: string
  description?: string
  type: string
  config: string
  status: string
  accuracy?: number
  createdAt: Date
  updatedAt: Date
  userId: number
  user?: {
    id: number
    name: string
    email: string
  }
  trainings?: ModelTraining[]
}

export interface ModelTraining {
  id: number
  status: string
  config: string
  logs?: string
  metrics?: string
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  modelId: number
}

export interface ModelForm {
  name: string
  description: string
  type: string
  config: string
  hyperparameters: {
    learningRate: number
    batchSize: number
    epochs: number
    optimizer: string
  }
}

export interface ModelTestResult {
  id: number
  input: string
  output: string
  confidence: number
  processingTime: number
  timestamp: Date
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface ModelState {
  // Core model data
  models: Model[]
  loading: boolean
  error: string | null
  success: string | null

  // Builder state
  builderForm: ModelForm
  builderStep: number
  builderSteps: Array<{
    title: string
    subtitle: string
    icon: string
    description: string
  }>

  // Validation state
  validationErrors: {
    name: string
    description: string
    type: string
    config: string
  }

  // Test state
  testResults: ModelTestResult[]
  testInput: string
  testLoading: boolean

  // Training state
  trainingModelIds: Set<number>
  trainingProgress: Record<number, number>
}

export const useModelStore = defineStore('model', {
  state: (): ModelState => ({
    // Core model data
    models: [],
    loading: false,
    error: null,
    success: null,

    // Builder state
    builderForm: {
      name: '',
      description: '',
      type: 'text-classification',
      config: '',
      hyperparameters: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 10,
        optimizer: 'adam',
      },
    },
    builderStep: 0,
    builderSteps: [
      {
        title: 'Basic Info',
        subtitle: 'Model name & description',
        icon: 'mdi-information',
        description:
          'Enter the basic information about your model including name, description, and type.',
      },
      {
        title: 'Configuration',
        subtitle: 'Model architecture & config',
        icon: 'mdi-cog',
        description: 'Configure the model architecture and parameters.',
      },
      {
        title: 'Hyperparameters',
        subtitle: 'Training parameters',
        icon: 'mdi-tune',
        description: 'Set the training hyperparameters for optimal performance.',
      },
      {
        title: 'Review',
        subtitle: 'Review & create',
        icon: 'mdi-check',
        description: 'Review your model configuration before creation.',
      },
    ],

    // Validation state
    validationErrors: {
      name: '',
      description: '',
      type: '',
      config: '',
    },

    // Test state
    testResults: [],
    testInput: '',
    testLoading: false,

    // Training state
    trainingModelIds: new Set(),
    trainingProgress: {},
  }),

  getters: {
    // Core model getters
    allModels: state => state.models,
    modelById: state => (id: number) => state.models.find(m => m.id === id),
    modelsByType: state => (type: string) => state.models.filter(m => m.type === type),
    readyModels: state => state.models.filter(m => m.status === 'ready'),
    modelsInTraining: state => state.models.filter(m => m.status === 'training'),
    draftModels: state => state.models.filter(m => m.status === 'draft'),
    deployedModels: state => state.models.filter(m => m.status === 'deployed'),
    isLoading: state => state.loading,
    hasError: state => state.error !== null,
    hasSuccess: state => state.success !== null,

    // Builder getters
    builderProgress: state => ((state.builderStep + 1) / state.builderSteps.length) * 100,
    currentBuilderStep: state => state.builderSteps[state.builderStep],
    isBuilderStepComplete: state => (stepIndex: number) => stepIndex < state.builderStep,
    canProceedToNextStep: state => {
      const currentStep = state.builderStep
      if (currentStep === 0)
        return state.builderForm.name.trim() !== '' && state.builderForm.description.trim() !== ''
      if (currentStep === 1)
        return state.builderForm.type.trim() !== '' && state.builderForm.config.trim() !== ''
      return true
    },

    // Validation getters
    hasValidationErrors: state => Object.values(state.validationErrors).some(error => error !== ''),

    // Test getters
    hasTestResults: state => state.testResults.length > 0,
    lastTestResult: state => state.testResults[state.testResults.length - 1],

    // Training getters
    isTraining: state => (modelId: number) => state.trainingModelIds.has(modelId),
    getTrainingProgress: state => (modelId: number) => state.trainingProgress[modelId] || 0,
  },

  actions: {
    // Core model actions
    async fetchAll() {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<ApiResponse<Model[]>>('/api/prisma/models')
        if (response.success) {
          this.models = response.data || []
        } else {
          this.error = response.message || 'Failed to fetch models'
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch models'
        console.error('Error fetching models:', error)
      } finally {
        this.loading = false
      }
    },

    async createModel(modelData: Omit<Model, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) {
      this.loading = true
      this.error = null
      this.success = null

      try {
        const response = await $fetch<ApiResponse<Model>>('/api/prisma/models', {
          method: 'POST',
          body: modelData,
        })

        if (response.success) {
          this.models.unshift(response.data)
          this.success = 'Model created successfully'
          return response.data
        } else {
          this.error = response.message || 'Failed to create model'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to create model'
        console.error('Error creating model:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async updateModel(id: number, modelData: Partial<Model>) {
      this.loading = true
      this.error = null
      this.success = null

      try {
        const response = await $fetch<ApiResponse<Model>>(`/api/prisma/models/${id}`, {
          method: 'PUT',
          body: modelData,
        })

        if (response.success) {
          const index = this.models.findIndex(m => m.id === id)
          if (index >= 0) {
            this.models[index] = response.data
          }
          this.success = 'Model updated successfully'
          return response.data
        } else {
          this.error = response.message || 'Failed to update model'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to update model'
        console.error('Error updating model:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async deleteModel(id: number) {
      this.loading = true
      this.error = null
      this.success = null

      try {
        const response = await $fetch<ApiResponse<boolean>>(`/api/prisma/models/${id}`, {
          method: 'DELETE',
        })

        if (response.success) {
          const index = this.models.findIndex(m => m.id === id)
          if (index >= 0) {
            this.models.splice(index, 1)
          }
          this.success = 'Model deleted successfully'
          return true
        } else {
          this.error = response.message || 'Failed to delete model'
          return false
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to delete model'
        console.error('Error deleting model:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    // Builder actions
    updateBuilderForm(field: keyof ModelForm, value: any) {
      if (field === 'hyperparameters') {
        this.builderForm.hyperparameters = { ...this.builderForm.hyperparameters, ...value }
      } else {
        ;(this.builderForm as any)[field] = value
      }
      this.validateField(field)
    },

    nextBuilderStep() {
      if (this.builderStep < this.builderSteps.length - 1) {
        this.builderStep++
      }
    },

    prevBuilderStep() {
      if (this.builderStep > 0) {
        this.builderStep--
      }
    },

    goToBuilderStep(stepIndex: number) {
      if (stepIndex >= 0 && stepIndex < this.builderSteps.length) {
        this.builderStep = stepIndex
      }
    },

    resetBuilder() {
      this.builderForm = {
        name: '',
        description: '',
        type: 'text-classification',
        config: '',
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 10,
          optimizer: 'adam',
        },
      }
      this.builderStep = 0
      this.clearValidationErrors()
    },

    async submitBuilder() {
      this.validateAllFields()
      if (this.hasValidationErrors) {
        return false
      }

      try {
        const modelData = {
          name: this.builderForm.name,
          description: this.builderForm.description,
          type: this.builderForm.type,
          config: JSON.stringify({
            ...JSON.parse(this.builderForm.config),
            hyperparameters: this.builderForm.hyperparameters,
          }),
          status: 'draft',
        }

        const result = await this.createModel(modelData)
        if (result) {
          this.resetBuilder()
          return true
        }
        return false
      } catch (error) {
        console.error('Error submitting model:', error)
        return false
      }
    },

    // Validation actions
    validateField(field: keyof ModelForm) {
      switch (field) {
        case 'name':
          this.validationErrors.name = this.builderForm.name.trim() === '' ? 'Name is required' : ''
          break
        case 'description':
          this.validationErrors.description =
            this.builderForm.description.trim() === '' ? 'Description is required' : ''
          break
        case 'type':
          this.validationErrors.type = this.builderForm.type.trim() === '' ? 'Type is required' : ''
          break
        case 'config':
          this.validationErrors.config =
            this.builderForm.config.trim() === '' ? 'Configuration is required' : ''
          break
      }
    },

    validateAllFields() {
      this.validateField('name')
      this.validateField('description')
      this.validateField('type')
      this.validateField('config')
    },

    clearValidationErrors() {
      this.validationErrors = {
        name: '',
        description: '',
        type: '',
        config: '',
      }
    },

    // Test actions
    async testModel(modelId: number, input: string) {
      if (!input.trim()) return

      this.testLoading = true

      try {
        const response = await $fetch<ApiResponse<ModelTestResult>>(`/api/models/${modelId}/test`, {
          method: 'POST',
          body: { input },
        })

        if (response.success) {
          this.testResults.push(response.data)
          this.testInput = ''
        } else {
          this.error = response.message || 'Failed to test model'
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to test model'
        console.error('Error testing model:', error)
      } finally {
        this.testLoading = false
      }
    },

    resetTest() {
      this.testResults = []
      this.testInput = ''
    },

    updateTestInput(input: string) {
      this.testInput = input
    },

    // Training actions
    async startTraining(modelId: number) {
      this.trainingModelIds.add(modelId)
      this.trainingProgress[modelId] = 0

      try {
        const response = await $fetch<ApiResponse<ModelTraining>>(`/api/models/${modelId}/train`, {
          method: 'POST',
        })

        if (response.success) {
          // Update model status
          const model = this.models.find(m => m.id === modelId)
          if (model) {
            model.status = 'training'
          }

          // Simulate training progress
          this.simulateTrainingProgress(modelId)
        } else {
          this.error = response.message || 'Failed to start training'
          this.trainingModelIds.delete(modelId)
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to start training'
        console.error('Error starting training:', error)
        this.trainingModelIds.delete(modelId)
      }
    },

    simulateTrainingProgress(modelId: number) {
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 10
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          this.trainingModelIds.delete(modelId)

          // Update model status to ready
          const model = this.models.find(m => m.id === modelId)
          if (model) {
            model.status = 'ready'
          }
        }
        this.trainingProgress[modelId] = progress
      }, 1000)
    },

    async deployModel(modelId: number) {
      try {
        const response = await $fetch<ApiResponse<Model>>(`/api/models/${modelId}/deploy`, {
          method: 'POST',
        })

        if (response.success) {
          const index = this.models.findIndex(m => m.id === modelId)
          if (index >= 0) {
            this.models[index] = response.data
          }
          this.success = 'Model deployed successfully'
          return true
        } else {
          this.error = response.message || 'Failed to deploy model'
          return false
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to deploy model'
        console.error('Error deploying model:', error)
        return false
      }
    },

    // Utility actions
    clearError() {
      this.error = null
    },

    clearSuccess() {
      this.success = null
    },
  },
})
