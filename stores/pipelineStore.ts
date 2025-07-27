import { defineStore } from 'pinia'

export interface Pipeline {
  id: number
  name: string
  description?: string
  config: string
  status: string
  createdAt: Date
  updatedAt: Date
  userId: number
  user?: {
    id: number
    name: string
    email: string
  }
  runs?: PipelineRun[]
}

export interface PipelineRun {
  id: number
  status: string
  config: string
  logs?: string
  results?: string
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  pipelineId: number
}

export interface PipelineForm {
  name: string
  description: string
  config: string
  modelId?: number
  steps: PipelineStep[]
}

export interface PipelineStep {
  name: string
  type: string
  config: any
  order: number
}

export interface PipelineTestResult {
  id: number
  input: string
  output: string
  processingTime: number
  status: string
  error?: string
}

interface PipelineState {
  // Core pipeline data
  pipelines: Pipeline[]
  loading: boolean
  error: string | null
  success: string | null

  // Builder state
  builderForm: PipelineForm
  builderStep: number
  builderSteps: Array<{
    title: string
    subtitle: string
    icon: string
    description: string
  }>

  // Validation state
  validationErrors: Record<string, string>

  // Test state
  testResults: PipelineTestResult[]
  testInput: string
  testLoading: boolean

  // Run state
  runningPipelines: number[]
  runProgress: Record<number, number>
}

export const usePipelineStore = defineStore('pipeline', {
  state: (): PipelineState => ({
    // Core pipeline data
    pipelines: [],
    loading: false,
    error: null,
    success: null,

    // Builder state
    builderForm: {
      name: '',
      description: '',
      config: '',
      modelId: undefined,
      steps: [],
    },
    builderStep: 0,
    builderSteps: [
      {
        title: 'Basic Information',
        subtitle: 'Pipeline name and description',
        icon: 'mdi-information',
        description: 'Enter the basic information about your pipeline.',
      },
      {
        title: 'Model Selection',
        subtitle: 'Choose the model',
        icon: 'mdi-brain',
        description: 'Select the model for your pipeline.',
      },
      {
        title: 'Configuration',
        subtitle: 'Pipeline configuration',
        icon: 'mdi-cog',
        description: 'Configure the pipeline steps and settings.',
      },
      {
        title: 'Review & Create',
        subtitle: 'Review and create pipeline',
        icon: 'mdi-check',
        description: 'Review your pipeline configuration and create it.',
      },
    ],

    // Validation state
    validationErrors: {},

    // Test state
    testResults: [],
    testInput: '',
    testLoading: false,

    // Run state
    runningPipelines: [],
    runProgress: {},
  }),

  getters: {
    // Core getters
    allPipelines: state => state.pipelines,
    pipelineById: state => (id: number) =>
      state.pipelines.find(p => p.id === id),
    pipelinesByStatus: state => (status: string) =>
      state.pipelines.filter(p => p.status === status),

    // Loading and error states
    isLoading: state => state.loading,
    hasError: state => !!state.error,
    hasSuccess: state => !!state.success,

    // Builder getters
    currentBuilderStep: state => state.builderSteps[state.builderStep],
    builderProgress: state =>
      ((state.builderStep + 1) / state.builderSteps.length) * 100,
    canProceedToNextStep: state => {
      const form = state.builderForm
      switch (state.builderStep) {
        case 0:
          return !!form.name && !state.validationErrors.name
        case 1:
          return !!form.modelId && !state.validationErrors.modelId
        case 2:
          return form.steps.length > 0 && !state.validationErrors.config
        default:
          return true
      }
    },
    hasValidationErrors: state =>
      Object.keys(state.validationErrors).length > 0,

    // Test getters
    testResultsByPipeline: state => (pipelineId: number) =>
      state.testResults.filter(r => r.id === pipelineId),

    // Run getters
    isPipelineRunning: state => (pipelineId: number) =>
      state.runningPipelines.includes(pipelineId),
    pipelineProgress: state => (pipelineId: number) =>
      state.runProgress[pipelineId] || 0,
  },

  actions: {
    // Core pipeline actions
    async fetchAll() {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch('/api/pipelines')
        const data = (response as any).data
        this.pipelines = data
        this.success = `Loaded ${data.length} pipelines`
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch pipelines'
        console.error('Error fetching pipelines:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchPipeline(id: number) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch(`/api/pipelines/${id}`)
        const data = (response as any).data
        const index = this.pipelines.findIndex(p => p.id === id)

        if (index >= 0) {
          this.pipelines[index] = data
        } else {
          this.pipelines.push(data)
        }

        return data
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch pipeline'
        console.error('Error fetching pipeline:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async createPipeline(pipelineData: Partial<Pipeline>) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch('/api/pipelines', {
          method: 'POST',
          body: pipelineData,
        })
        const data = (response as any).data

        this.pipelines.unshift(data)
        this.success = `Pipeline "${data.name}" created successfully`

        return data
      } catch (error: any) {
        this.error = error.message || 'Failed to create pipeline'
        console.error('Error creating pipeline:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updatePipeline(id: number, updates: Partial<Pipeline>) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch(`/api/pipelines/${id}`, {
          method: 'PUT' as any,
          body: updates,
        })
        const data = (response as any).data

        const index = this.pipelines.findIndex(p => p.id === id)
        if (index >= 0) {
          this.pipelines[index] = data
        }

        this.success = `Pipeline "${data.name}" updated successfully`
        return data
      } catch (error: any) {
        this.error = error.message || 'Failed to update pipeline'
        console.error('Error updating pipeline:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deletePipeline(id: number) {
      this.loading = true
      this.error = null

      try {
        await $fetch(`/api/pipelines/${id}`, {
          method: 'DELETE' as any,
        })

        const index = this.pipelines.findIndex(p => p.id === id)
        if (index >= 0) {
          const deletedPipeline = this.pipelines[index]
          this.pipelines.splice(index, 1)
          this.success = `Pipeline "${deletedPipeline.name}" deleted successfully`
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to delete pipeline'
        console.error('Error deleting pipeline:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // Builder actions
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

    setBuilderStep(step: number) {
      if (step >= 0 && step < this.builderSteps.length) {
        this.builderStep = step
      }
    },

    updateBuilderForm(updates: Partial<PipelineForm>) {
      this.builderForm = { ...this.builderForm, ...updates }
    },

    resetBuilderForm() {
      this.builderForm = {
        name: '',
        description: '',
        config: '',
        modelId: undefined,
        steps: [],
      }
      this.builderStep = 0
      this.validationErrors = {}
    },

    resetBuilder() {
      this.resetBuilderForm()
    },

    // Validation actions
    setValidationError(field: string, error: string) {
      this.validationErrors[field] = error
    },

    clearValidationError(field: string) {
      delete this.validationErrors[field]
    },

    clearAllValidationErrors() {
      this.validationErrors = {}
    },

    // Test actions
    async testPipeline(pipelineId: number, input: string) {
      this.testLoading = true
      this.error = null

      try {
        const response = await $fetch(`/api/pipelines/${pipelineId}/test`, {
          method: 'POST' as any,
          body: { input },
        })
        const data = (response as any).data

        this.testResults.unshift(data)
        this.success = 'Pipeline test completed successfully'

        return data
      } catch (error: any) {
        this.error = error.message || 'Pipeline test failed'
        console.error('Error testing pipeline:', error)
        throw error
      } finally {
        this.testLoading = false
      }
    },

    // Run actions
    async executePipeline(pipelineId: number, input: any) {
      if (this.runningPipelines.includes(pipelineId)) {
        throw new Error('Pipeline is already running')
      }

      this.runningPipelines.push(pipelineId)
      this.runProgress[pipelineId] = 0

      try {
        const response = await $fetch(`/api/pipelines/${pipelineId}/execute`, {
          method: 'POST' as any,
          body: { input },
        })
        const data = (response as any).data

        this.runProgress[pipelineId] = 100
        return data
      } catch (error: any) {
        this.error = error.message || 'Pipeline execution failed'
        console.error('Error executing pipeline:', error)
        throw error
      } finally {
        const index = this.runningPipelines.indexOf(pipelineId)
        if (index >= 0) {
          this.runningPipelines.splice(index, 1)
        }
        delete this.runProgress[pipelineId]
      }
    },

    async stopPipeline(pipelineId: number) {
      try {
        await $fetch(`/api/pipelines/${pipelineId}/stop`, {
          method: 'POST' as any,
        })

        const index = this.runningPipelines.indexOf(pipelineId)
        if (index >= 0) {
          this.runningPipelines.splice(index, 1)
        }
        delete this.runProgress[pipelineId]

        this.success = 'Pipeline stopped successfully'
      } catch (error: any) {
        this.error = error.message || 'Failed to stop pipeline'
        console.error('Error stopping pipeline:', error)
        throw error
      }
    },

    // Utility actions
    clearError() {
      this.error = null
    },

    clearSuccess() {
      this.success = null
    },

    clearMessages() {
      this.error = null
      this.success = null
    },
  },
})
