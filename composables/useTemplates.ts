import { ref } from 'vue'

interface Template {
  id: string
  name: string
  description: string
  type: 'bot' | 'model' | 'pipeline'
  config: any
  category: string
  tags: string[]
}

export const useTemplates = () => {
  const templates = ref<Template[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

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
        systemPrompt: 'You are a customer support representative. Be helpful and professional.',
        temperature: 0.3,
      },
      category: 'support',
      tags: ['customer-service', 'support', 'professional'],
    },
  ])

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
  ])

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
          { name: 'data_loading', type: 'input' },
          { name: 'feature_engineering', type: 'transformation' },
          { name: 'model_training', type: 'training' },
          { name: 'model_evaluation', type: 'evaluation' },
          { name: 'model_deployment', type: 'deployment' },
        ],
      },
      category: 'ml',
      tags: ['training', 'ml', 'automation'],
    },
  ])

  const getTemplatesByType = (type: 'bot' | 'model' | 'pipeline') => {
    switch (type) {
      case 'bot':
        return botTemplates.value
      case 'model':
        return modelTemplates.value
      case 'pipeline':
        return pipelineTemplates.value
      default:
        return []
    }
  }

  const getTemplateById = (id: string) => {
    const allTemplates = [
      ...botTemplates.value,
      ...modelTemplates.value,
      ...pipelineTemplates.value,
    ]
    return allTemplates.find(template => template.id === id)
  }

  const searchTemplates = (query: string, type?: 'bot' | 'model' | 'pipeline') => {
    const searchTerm = query.toLowerCase()
    let templatesToSearch = []

    if (type) {
      templatesToSearch = getTemplatesByType(type)
    } else {
      templatesToSearch = [
        ...botTemplates.value,
        ...modelTemplates.value,
        ...pipelineTemplates.value,
      ]
    }

    return templatesToSearch.filter(template =>
      template.name.toLowerCase().includes(searchTerm) ||
      template.description.toLowerCase().includes(searchTerm) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    )
  }

  return {
    templates,
    loading,
    error,
    botTemplates,
    modelTemplates,
    pipelineTemplates,
    getTemplatesByType,
    getTemplateById,
    searchTemplates,
  }
}
