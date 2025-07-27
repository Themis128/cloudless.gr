import { computed } from 'vue'

// Re-export types for backward compatibility
export interface Template {
  id: string
  name: string
  description: string
  type: 'bot' | 'model' | 'pipeline'
  config: any
  category: string
  tags: string[]
  createdAt?: string
  updatedAt?: string
}

// Composable that uses the Pinia store
export const useTemplates = () => {
  const templateStore = useTemplateStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    templates: computed(() => templateStore.templates),
    loading: computed(() => templateStore.isLoading),
    error: computed(() => templateStore.error),
    selectedTemplate: computed(() => templateStore.selectedTemplate),

    // Default templates (readonly for backward compatibility)
    botTemplates: computed(() => templateStore.botTemplates),
    modelTemplates: computed(() => templateStore.modelTemplates),
    pipelineTemplates: computed(() => templateStore.pipelineTemplates),

    // Computed properties
    allTemplates: computed(() => templateStore.allTemplates),

    // Methods (delegate to store)
    getTemplatesByType: templateStore.getTemplatesByType,
    getTemplatesByCategory: templateStore.getTemplatesByCategory,
    getTemplatesByTag: templateStore.getTemplatesByTag,
    getTemplateById: templateStore.getTemplateById,
    searchTemplates: templateStore.searchTemplates,
    selectTemplate: templateStore.selectTemplate,
    addTemplate: templateStore.addTemplate,
    updateTemplate: templateStore.updateTemplate,
    deleteTemplate: templateStore.deleteTemplate,
    duplicateTemplate: templateStore.duplicateTemplate,
    importTemplates: templateStore.importTemplates,
    exportTemplates: templateStore.exportTemplates,
    clearCustomTemplates: templateStore.clearCustomTemplates,
    getTemplateCategories: templateStore.getTemplateCategories,
    getTemplateTags: templateStore.getTemplateTags,
    setLoading: templateStore.setLoading,
    setError: templateStore.setError,
    clearError: templateStore.clearError,
  }
}
