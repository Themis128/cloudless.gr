import { computed } from 'vue'

// Composable that uses the Pinia store
export const usePrismaApi = () => {
  const prismaStore = usePrismaStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    isLoading: computed(() => prismaStore.isLoading),
    error: computed(() => prismaStore.error),

    // Project operations (delegate to store)
    getProjects: prismaStore.getProjects,
    getProject: prismaStore.getProject,
    createProject: prismaStore.createProject,

    // User operations (delegate to store)
    getUsers: prismaStore.getUsers,
    getUser: prismaStore.getUser,
    createUser: prismaStore.createUser,

    // Contact operations (delegate to store)
    createContactSubmission: prismaStore.createContactSubmission,
    getContactSubmissions: prismaStore.getContactSubmissions,

    // Additional store methods
    // Bot operations
    getBots: prismaStore.getBots,
    getBot: prismaStore.getBot,
    createBot: prismaStore.createBot,
    updateBot: prismaStore.updateBot,
    deleteBot: prismaStore.deleteBot,

    // Model operations
    getModels: prismaStore.getModels,
    getModel: prismaStore.getModel,
    createModel: prismaStore.createModel,
    updateModel: prismaStore.updateModel,
    deleteModel: prismaStore.deleteModel,

    // Pipeline operations
    getPipelines: prismaStore.getPipelines,
    getPipeline: prismaStore.getPipeline,
    createPipeline: prismaStore.createPipeline,
    updatePipeline: prismaStore.updatePipeline,
    deletePipeline: prismaStore.deletePipeline,

    // Training operations
    getTrainingSessions: prismaStore.getTrainingSessions,
    getTrainingSession: prismaStore.getTrainingSession,
    createTrainingSession: prismaStore.createTrainingSession,
    updateTrainingSession: prismaStore.updateTrainingSession,
    deleteTrainingSession: prismaStore.deleteTrainingSession,

    // Generic API call
    apiCall: prismaStore.apiCall,
  }
}
