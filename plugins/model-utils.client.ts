export default defineNuxtPlugin(() => {
  return {
    provide: {
      // Model validation utilities
      validateModelConfig: (config: string) => {
        try {
          const parsed = JSON.parse(config)
          return { valid: true, data: parsed }
        } catch (error) {
          return { valid: false, error: 'Invalid JSON configuration' }
        }
      },

      // Model type utilities
      getModelTypeInfo: (type: string) => {
        const typeInfo = {
          'text-classification': {
            name: 'Text Classification',
            description: 'Classify text into predefined categories',
            icon: 'mdi-text',
            color: 'primary',
            examples: ['Sentiment analysis', 'Topic classification', 'Spam detection']
          },
          'image-classification': {
            name: 'Image Classification',
            description: 'Classify images into predefined categories',
            icon: 'mdi-image',
            color: 'success',
            examples: ['Object recognition', 'Scene classification', 'Medical imaging']
          },
          'object-detection': {
            name: 'Object Detection',
            description: 'Detect and locate objects in images',
            icon: 'mdi-target',
            color: 'warning',
            examples: ['Face detection', 'Vehicle detection', 'Product detection']
          },
          'sentiment-analysis': {
            name: 'Sentiment Analysis',
            description: 'Analyze the sentiment of text',
            icon: 'mdi-emoticon',
            color: 'info',
            examples: ['Customer feedback', 'Social media monitoring', 'Review analysis']
          },
          'translation': {
            name: 'Translation',
            description: 'Translate text between languages',
            icon: 'mdi-translate',
            color: 'secondary',
            examples: ['Language translation', 'Document translation', 'Real-time translation']
          },
          'summarization': {
            name: 'Summarization',
            description: 'Generate summaries of text',
            icon: 'mdi-text-box',
            color: 'purple',
            examples: ['Article summarization', 'Document summarization', 'Meeting notes']
          },
          'regression': {
            name: 'Regression',
            description: 'Predict continuous values',
            icon: 'mdi-chart-line',
            color: 'orange',
            examples: ['Price prediction', 'Sales forecasting', 'Temperature prediction']
          },
          'clustering': {
            name: 'Clustering',
            description: 'Group similar data points',
            icon: 'mdi-chart-bubble',
            color: 'teal',
            examples: ['Customer segmentation', 'Document clustering', 'Image clustering']
          }
        }
        
        return typeInfo[type] || {
          name: 'Unknown Type',
          description: 'Unknown model type',
          icon: 'mdi-brain',
          color: 'grey',
          examples: []
        }
      },

      // Model status utilities
      getModelStatusInfo: (status: string) => {
        const statusInfo = {
          'draft': {
            name: 'Draft',
            description: 'Model is in draft state',
            color: 'warning',
            icon: 'mdi-pencil',
            canEdit: true,
            canTrain: true,
            canDeploy: false,
            canTest: false
          },
          'training': {
            name: 'Training',
            description: 'Model is currently training',
            color: 'info',
            icon: 'mdi-school',
            canEdit: false,
            canTrain: false,
            canDeploy: false,
            canTest: false
          },
          'ready': {
            name: 'Ready',
            description: 'Model is ready for deployment',
            color: 'success',
            icon: 'mdi-check-circle',
            canEdit: true,
            canTrain: false,
            canDeploy: true,
            canTest: true
          },
          'deployed': {
            name: 'Deployed',
            description: 'Model is deployed and active',
            color: 'primary',
            icon: 'mdi-rocket-launch',
            canEdit: false,
            canTrain: false,
            canDeploy: false,
            canTest: true
          },
          'error': {
            name: 'Error',
            description: 'Model encountered an error',
            color: 'error',
            icon: 'mdi-alert-circle',
            canEdit: true,
            canTrain: true,
            canDeploy: false,
            canTest: false
          }
        }
        
        return statusInfo[status] || {
          name: 'Unknown',
          description: 'Unknown status',
          color: 'grey',
          icon: 'mdi-help-circle',
          canEdit: false,
          canTrain: false,
          canDeploy: false,
          canTest: false
        }
      },

      // Model performance utilities
      formatAccuracy: (accuracy: number) => {
        return `${(accuracy * 100).toFixed(1)}%`
      },

      formatProcessingTime: (timeMs: number) => {
        if (timeMs < 1000) return `${timeMs}ms`
        return `${(timeMs / 1000).toFixed(2)}s`
      },

      // Model file utilities
      getModelFileSize: (sizeBytes: number) => {
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(sizeBytes) / Math.log(1024))
        return `${(sizeBytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
      },

      // Model export utilities
      exportModelConfig: (model: any) => {
        const config = {
          name: model.name,
          description: model.description,
          type: model.type,
          config: model.config,
          hyperparameters: model.hyperparameters,
          createdAt: model.createdAt,
          version: '1.0.0'
        }
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${model.name}-config.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    }
  }
}) 