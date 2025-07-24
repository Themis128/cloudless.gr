import { useModelStore } from '~/stores/modelStore'

export const useModels = () => {
  const modelStore = useModelStore()
  const { $fetch } = useNuxtApp()

  // Enhanced model fetching with caching
  const fetchModels = async (force = false) => {
    if (!force && modelStore.allModels.length > 0) {
      return modelStore.allModels
    }
    
    try {
      await modelStore.fetchAll()
      return modelStore.allModels
    } catch (error) {
      console.error('Failed to fetch models:', error)
      throw error
    }
  }

  // Real-time model updates using Nuxt's reactivity
  const watchModelChanges = (modelId: number) => {
    return computed(() => modelStore.modelById(modelId))
  }

  // Optimistic updates for better UX
  const updateModelOptimistically = async (modelId: number, updates: any) => {
    const originalModel = modelStore.modelById(modelId)
    if (!originalModel) return false

    // Apply optimistic update
    const optimisticModel = { ...originalModel, ...updates }
    modelStore.updateModel(modelId, optimisticModel)

    try {
      // Make actual API call
      await modelStore.updateModel(modelId, updates)
      return true
    } catch (error) {
      // Revert on error
      modelStore.updateModel(modelId, originalModel)
      throw error
    }
  }

  // Batch operations
  const batchDeleteModels = async (modelIds: number[]) => {
    const results = await Promise.allSettled(
      modelIds.map(id => modelStore.deleteModel(id))
    )
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    return { successful, failed, total: modelIds.length }
  }

  return {
    fetchModels,
    watchModelChanges,
    updateModelOptimistically,
    batchDeleteModels,
    // Expose store methods
    ...modelStore
  }
} 