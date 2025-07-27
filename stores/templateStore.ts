import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface Template {
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

export const useTemplateStore = defineStore('template', () => {
  // State
  const templates = ref<Template[]>([])
  const selectedTemplate = ref<Template | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Default bot templates
  const botTemplates = ref<Template[]>([
    {
      id: 'chatbot-basic',
      name: 'Basic Chatbot',
      description: 'A simple conversational chatbot template',
      type: 'bot',
      config: {
        model: 'gpt-3.5-turbo',
        systemPrompt: 'You are a helpful assistant.',
        temperature: 0.7,
      },
      category: 'conversation',
      tags: ['chat', 'basic', 'assistant'],
    },
    {
      id: 'customer-support',
      name: 'Customer Support Bot',
      description: 'Specialized bot for customer service',
      type: 'bot',
      config: {
        model: 'gpt-4',
        systemPrompt:
          'You are a customer support representative. Be helpful and professional.',
        temperature: 0.3,
      },
      category: 'support',
      tags: ['customer-service', 'support', 'professional'],
    },
    {
      id: 'code-assistant',
      name: 'Code Assistant Bot',
      description: 'Bot specialized in programming and code review',
      type: 'bot',
      config: {
        model: 'gpt-4',
        systemPrompt:
          'You are a programming assistant. Help with code reviews, debugging, and best practices.',
        temperature: 0.2,
      },
      category: 'development',
      tags: ['programming', 'code', 'development'],
    },
  ])

  // Default model templates
  const modelTemplates = ref<Template[]>([
    {
      id: 'text-classification',
      name: 'Text Classification',
      description: 'Template for text classification models',
      type: 'model',
      config: {
        task: 'classification',
        architecture: 'transformer',
        epochs: 10,
        batchSize: 32,
      },
      category: 'nlp',
      tags: ['classification', 'text', 'nlp'],
    },
    {
      id: 'sentiment-analysis',
      name: 'Sentiment Analysis',
      description: 'Template for sentiment analysis models',
      type: 'model',
      config: {
        task: 'sentiment',
        architecture: 'lstm',
        epochs: 15,
        batchSize: 64,
      },
      category: 'nlp',
      tags: ['sentiment', 'analysis', 'nlp'],
    },
    {
      id: 'image-classification',
      name: 'Image Classification',
      description: 'Template for image classification models',
      type: 'model',
      config: {
        task: 'classification',
        architecture: 'cnn',
        epochs: 20,
        batchSize: 16,
      },
      category: 'computer-vision',
      tags: ['image', 'classification', 'cnn'],
    },
  ])

  // Default pipeline templates
  const pipelineTemplates = ref<Template[]>([
    {
      id: 'data-processing',
      name: 'Data Processing Pipeline',
      description: 'Basic data processing and transformation pipeline',
      type: 'pipeline',
      config: {
        steps: [
          { name: 'data_ingestion', type: 'input' },
          { name: 'data_cleaning', type: 'transformation' },
          { name: 'data_validation', type: 'validation' },
          { name: 'data_output', type: 'output' },
        ],
      },
      category: 'data',
      tags: ['processing', 'transformation', 'data'],
    },
    {
      id: 'ml-training',
      name: 'ML Training Pipeline',
      description: 'Complete machine learning training pipeline',
      type: 'pipeline',
      config: {
        steps: [
          { name: 'data_preparation', type: 'preprocessing' },
          { name: 'feature_engineering', type: 'transformation' },
          { name: 'model_training', type: 'training' },
          { name: 'model_evaluation', type: 'evaluation' },
          { name: 'model_deployment', type: 'deployment' },
        ],
      },
      category: 'ml',
      tags: ['training', 'ml', 'pipeline'],
    },
    {
      id: 'nlp-pipeline',
      name: 'NLP Pipeline',
      description: 'Natural language processing pipeline',
      type: 'pipeline',
      config: {
        steps: [
          { name: 'text_preprocessing', type: 'preprocessing' },
          { name: 'tokenization', type: 'transformation' },
          { name: 'embedding_generation', type: 'embedding' },
          { name: 'model_inference', type: 'inference' },
          { name: 'result_postprocessing', type: 'postprocessing' },
        ],
      },
      category: 'nlp',
      tags: ['nlp', 'text', 'processing'],
    },
  ])

  // Computed properties
  const allTemplates = computed(() => [
    ...botTemplates.value,
    ...modelTemplates.value,
    ...pipelineTemplates.value,
    ...templates.value,
  ])

  const getTemplatesByType = (type: 'bot' | 'model' | 'pipeline') => {
    return allTemplates.value.filter(template => template.type === type)
  }

  const getTemplatesByCategory = (category: string) => {
    return allTemplates.value.filter(template => template.category === category)
  }

  const getTemplatesByTag = (tag: string) => {
    return allTemplates.value.filter(template => template.tags.includes(tag))
  }

  // Actions
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }

  const clearError = () => {
    error.value = null
  }

  const selectTemplate = (template: Template | null) => {
    selectedTemplate.value = template
  }

  const getTemplateById = (id: string) => {
    return allTemplates.value.find(template => template.id === id) || null
  }

  const searchTemplates = (
    query: string,
    type?: 'bot' | 'model' | 'pipeline'
  ) => {
    const searchQuery = query.toLowerCase()
    let searchTemplates = allTemplates.value

    if (type) {
      searchTemplates = searchTemplates.filter(
        template => template.type === type
      )
    }

    return searchTemplates.filter(
      template =>
        template.name.toLowerCase().includes(searchQuery) ||
        template.description.toLowerCase().includes(searchQuery) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery)) ||
        template.category.toLowerCase().includes(searchQuery)
    )
  }

  const addTemplate = (template: Template) => {
    try {
      setLoading(true)
      setError(null)

      // Check if template with same ID already exists
      const existingTemplate = getTemplateById(template.id)
      if (existingTemplate) {
        setError(`Template with ID '${template.id}' already exists`)
        return false
      }

      // Add creation timestamp
      const newTemplate = {
        ...template,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      templates.value.push(newTemplate)
      return true
    } catch (err: any) {
      console.error('Error adding template:', err)
      setError(err.message || 'Failed to add template')
      return false
    } finally {
      setLoading(false)
    }
  }

  const updateTemplate = (id: string, updates: Partial<Template>) => {
    try {
      setLoading(true)
      setError(null)

      const templateIndex = templates.value.findIndex(t => t.id === id)
      if (templateIndex === -1) {
        setError(`Template with ID '${id}' not found`)
        return false
      }

      templates.value[templateIndex] = {
        ...templates.value[templateIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      return true
    } catch (err: any) {
      console.error('Error updating template:', err)
      setError(err.message || 'Failed to update template')
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteTemplate = (id: string) => {
    try {
      setLoading(true)
      setError(null)

      const templateIndex = templates.value.findIndex(t => t.id === id)
      if (templateIndex === -1) {
        setError(`Template with ID '${id}' not found`)
        return false
      }

      templates.value.splice(templateIndex, 1)
      return true
    } catch (err: any) {
      console.error('Error deleting template:', err)
      setError(err.message || 'Failed to delete template')
      return false
    } finally {
      setLoading(false)
    }
  }

  const duplicateTemplate = (id: string, newName?: string) => {
    try {
      setLoading(true)
      setError(null)

      const originalTemplate = getTemplateById(id)
      if (!originalTemplate) {
        setError(`Template with ID '${id}' not found`)
        return false
      }

      const newId = `${originalTemplate.id}-copy-${Date.now()}`
      const newTemplate: Template = {
        ...originalTemplate,
        id: newId,
        name: newName || `${originalTemplate.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      templates.value.push(newTemplate)
      return newTemplate
    } catch (err: any) {
      console.error('Error duplicating template:', err)
      setError(err.message || 'Failed to duplicate template')
      return false
    } finally {
      setLoading(false)
    }
  }

  const importTemplates = (templatesToImport: Template[]) => {
    try {
      setLoading(true)
      setError(null)

      let importedCount = 0
      let skippedCount = 0

      for (const template of templatesToImport) {
        const existingTemplate = getTemplateById(template.id)
        if (existingTemplate) {
          skippedCount++
          continue
        }

        const newTemplate = {
          ...template,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        templates.value.push(newTemplate)
        importedCount++
      }

      return { importedCount, skippedCount }
    } catch (err: any) {
      console.error('Error importing templates:', err)
      setError(err.message || 'Failed to import templates')
      return { importedCount: 0, skippedCount: 0 }
    } finally {
      setLoading(false)
    }
  }

  const exportTemplates = (templateIds?: string[]) => {
    try {
      let templatesToExport = templateIds
        ? allTemplates.value.filter(t => templateIds.includes(t.id))
        : allTemplates.value

      return JSON.stringify(templatesToExport, null, 2)
    } catch (err: any) {
      console.error('Error exporting templates:', err)
      setError(err.message || 'Failed to export templates')
      return null
    }
  }

  const clearCustomTemplates = () => {
    templates.value = []
  }

  const getTemplateCategories = () => {
    const categories = new Set<string>()
    allTemplates.value.forEach(template => {
      categories.add(template.category)
    })
    return Array.from(categories).sort()
  }

  const getTemplateTags = () => {
    const tags = new Set<string>()
    allTemplates.value.forEach(template => {
      template.tags.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }

  return {
    // State
    templates,
    selectedTemplate,
    isLoading,
    error,
    botTemplates,
    modelTemplates,
    pipelineTemplates,

    // Computed
    allTemplates,
    getTemplatesByType,
    getTemplatesByCategory,
    getTemplatesByTag,

    // Methods
    setLoading,
    setError,
    clearError,
    selectTemplate,
    getTemplateById,
    searchTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    importTemplates,
    exportTemplates,
    clearCustomTemplates,
    getTemplateCategories,
    getTemplateTags,
  }
})
