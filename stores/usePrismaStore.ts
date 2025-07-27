import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePrismaStore = defineStore('prisma', () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Generic API call function
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch(endpoint, {
        ...options,
        method: options.method as any,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      return response
    } catch (err: any) {
      error.value = err.message || 'An error occurred'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // User operations
  const getUsers = () => apiCall('/api/users')
  const getUser = (id: number) => apiCall(`/api/users/${id}`)
  const createUser = (userData: any) =>
    apiCall('/api/users', {
      method: 'POST',
      body: userData,
    })

  // Project operations
  const getProjects = () => apiCall('/api/projects')
  const getProject = (id: number) => apiCall(`/api/projects/${id}`)
  const createProject = (projectData: any) =>
    apiCall('/api/projects', {
      method: 'POST',
      body: projectData,
    })

  // Contact operations
  const createContactSubmission = (contactData: any) =>
    apiCall('/api/contact', {
      method: 'POST',
      body: contactData,
    })
  const getContactSubmissions = () => apiCall('/api/contact-submissions')

  // Bot operations
  const getBots = () => apiCall('/api/bots')
  const getBot = (id: number) => apiCall(`/api/bots/${id}`)
  const createBot = (botData: any) =>
    apiCall('/api/bots', {
      method: 'POST',
      body: botData,
    })
  const updateBot = (id: number, botData: any) =>
    apiCall(`/api/bots/${id}`, {
      method: 'PUT',
      body: botData,
    })
  const deleteBot = (id: number) =>
    apiCall(`/api/bots/${id}`, {
      method: 'DELETE',
    })

  // Model operations
  const getModels = () => apiCall('/api/models')
  const getModel = (id: number) => apiCall(`/api/models/${id}`)
  const createModel = (modelData: any) =>
    apiCall('/api/models', {
      method: 'POST',
      body: modelData,
    })
  const updateModel = (id: number, modelData: any) =>
    apiCall(`/api/models/${id}`, {
      method: 'PUT',
      body: modelData,
    })
  const deleteModel = (id: number) =>
    apiCall(`/api/models/${id}`, {
      method: 'DELETE',
    })

  // Pipeline operations
  const getPipelines = () => apiCall('/api/pipelines')
  const getPipeline = (id: number) => apiCall(`/api/pipelines/${id}`)
  const createPipeline = (pipelineData: any) =>
    apiCall('/api/pipelines', {
      method: 'POST',
      body: pipelineData,
    })
  const updatePipeline = (id: number, pipelineData: any) =>
    apiCall(`/api/pipelines/${id}`, {
      method: 'PUT',
      body: pipelineData,
    })
  const deletePipeline = (id: number) =>
    apiCall(`/api/pipelines/${id}`, {
      method: 'DELETE',
    })

  // Training session operations
  const getTrainingSessions = () => apiCall('/api/training-sessions')
  const getTrainingSession = (id: number) =>
    apiCall(`/api/training-sessions/${id}`)
  const createTrainingSession = (trainingData: any) =>
    apiCall('/api/training-sessions', {
      method: 'POST',
      body: trainingData,
    })
  const updateTrainingSession = (id: number, trainingData: any) =>
    apiCall(`/api/training-sessions/${id}`, {
      method: 'PUT',
      body: trainingData,
    })
  const deleteTrainingSession = (id: number) =>
    apiCall(`/api/training-sessions/${id}`, {
      method: 'DELETE',
    })

  return {
    // State
    isLoading,
    error,

    // User operations
    getUsers,
    getUser,
    createUser,

    // Project operations
    getProjects,
    getProject,
    createProject,

    // Contact operations
    createContactSubmission,
    getContactSubmissions,

    // Bot operations
    getBots,
    getBot,
    createBot,
    updateBot,
    deleteBot,

    // Model operations
    getModels,
    getModel,
    createModel,
    updateModel,
    deleteModel,

    // Pipeline operations
    getPipelines,
    getPipeline,
    createPipeline,
    updatePipeline,
    deletePipeline,

    // Training session operations
    getTrainingSessions,
    getTrainingSession,
    createTrainingSession,
    updateTrainingSession,
    deleteTrainingSession,

    // Generic API call
    apiCall,
  }
})
