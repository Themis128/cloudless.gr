import { defineStore } from 'pinia'

export interface Bot {
  id: number
  name: string
  description: string
  status: 'active' | 'inactive' | 'training'
  model_id?: number
  pipeline_id?: number
  config: any
  createdAt: Date
  updatedAt: Date
}

export interface BotForm {
  name: string
  prompt: string
  model: string
  memory: string
  tools: string
}

export interface BotTestMessage {
  id: number
  role: 'user' | 'bot'
  text: string
  timestamp?: Date
}

export interface BotTestStep {
  name: string
  status: 'pending' | 'running' | 'complete' | 'error'
  result?: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface BotState {
  // Core bot data
  bots: Bot[]
  loading: boolean
  error: string | null
  success: string | null
  
  // Builder state
  builderForm: BotForm
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
    prompt: string
    model: string
  }
  
  // Test state
  testMessages: BotTestMessage[]
  testSteps: BotTestStep[]
  testProgress: number
  testInput: string
}

export const useBotStore = defineStore('bot', {
  state: (): BotState => ({
    // Core bot data
    bots: [],
    loading: false,
    error: null,
    success: null,
    
    // Builder state
    builderForm: {
      name: '',
      prompt: `You are a highly capable AI development assistant. Your role is to help with coding tasks, debugging, and development workflows.

Key Responsibilities:
1. Code Analysis & Generation
   - Review and understand existing code
   - Generate new code following best practices
   - Suggest improvements and optimizations

2. Problem Solving
   - Debug issues systematically
   - Propose solutions with explanations
   - Consider edge cases and error handling

3. Development Support
   - Help with project setup and configuration
   - Guide through development workflows
   - Assist with testing and deployment

4. Best Practices
   - Follow language-specific conventions
   - Implement security best practices
   - Write maintainable and documented code

5. Tool Usage
   - Use appropriate development tools
   - Leverage version control effectively
   - Integrate with development workflows

Always provide clear explanations and context for your actions. When making changes, ensure backward compatibility and document any assumptions or dependencies.`,
      model: '',
      memory: '4000',
      tools: 'file_search,codebase_search,read_file,edit_file,run_terminal_cmd,web_search,grep_search'
    },
    builderStep: 0,
    builderSteps: [
      {
        title: 'Details',
        subtitle: 'Bot name & prompt',
        icon: 'mdi-robot',
        description: 'Enter the bot name and prompt.<br><br><strong>Default Prompt:</strong> Pre-configured with comprehensive development assistant instructions covering code analysis, problem solving, and best practices.'
      },
      {
        title: 'Model',
        subtitle: 'Select model',
        icon: 'mdi-brain',
        description: 'Choose the model for your bot.'
      },
      {
        title: 'Settings',
        subtitle: 'Memory & tools',
        icon: 'mdi-cog',
        description: 'Configure memory and tools settings.<br><br><strong>Memory Context:</strong> Default is 4000 tokens for optimal context retention.<br><strong>Tools:</strong> Pre-configured with essential development tools for code search, file operations, and web searches.'
      },
      {
        title: 'Summary',
        subtitle: 'Review',
        icon: 'mdi-check',
        description: 'Review your bot setup.'
      }
    ],
    
    // Validation state
    validationErrors: {
      name: '',
      prompt: '',
      model: ''
    },
    
    // Test state
    testMessages: [],
    testSteps: [],
    testProgress: 0,
    testInput: ''
  }),

  getters: {
    // Core bot getters
    allBots: (state) => state.bots,
    botById: (state) => (id: number) => state.bots.find(b => b.id === id),
    activeBots: (state) => state.bots.filter(b => b.status === 'active'),
    isLoading: (state) => state.loading,
    hasError: (state) => state.error !== null,
    hasSuccess: (state) => state.success !== null,
    
    // Builder getters
    builderProgress: (state) => ((state.builderStep + 1) / state.builderSteps.length) * 100,
    currentBuilderStep: (state) => state.builderSteps[state.builderStep],
    isBuilderStepComplete: (state) => (stepIndex: number) => stepIndex < state.builderStep,
    canProceedToNextStep: (state) => {
      const currentStep = state.builderStep
      if (currentStep === 0) return state.builderForm.name.trim() !== '' && state.builderForm.prompt.trim() !== ''
      if (currentStep === 1) return state.builderForm.model.trim() !== ''
      return true
    },
    
    // Validation getters
    hasValidationErrors: (state) => Object.values(state.validationErrors).some(error => error !== ''),
    
    // Test getters
    hasTestMessages: (state) => state.testMessages.length > 0,
    lastTestMessage: (state) => state.testMessages[state.testMessages.length - 1]
  },

  actions: {
    // Core bot actions
    async fetchAll() {
      this.loading = true
      this.error = null
      
      try {
        const response = await $fetch<ApiResponse<Bot[]>>('/api/prisma/bots')
        if (response.success) {
          this.bots = response.data || []
        } else {
          this.error = response.message || 'Failed to fetch bots'
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch bots'
        console.error('Error fetching bots:', error)
      } finally {
        this.loading = false
      }
    },

    async createBot(botData: Omit<Bot, 'id' | 'createdAt' | 'updatedAt'>) {
      this.loading = true
      this.error = null
      this.success = null
      
      try {
        const response = await $fetch<ApiResponse<Bot>>('/api/prisma/bots', {
          method: 'POST',
          body: botData
        })
        
        if (response.success) {
          this.bots.unshift(response.data)
          this.success = 'Bot created successfully'
          return response.data
        } else {
          this.error = response.message || 'Failed to create bot'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to create bot'
        console.error('Error creating bot:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async updateBot(id: number, botData: Partial<Bot>) {
      this.loading = true
      this.error = null
      this.success = null
      
      try {
        const response = await $fetch<ApiResponse<Bot>>(`/api/prisma/bots/${id}`, {
          method: 'PUT',
          body: botData
        })
        
        if (response.success) {
          const index = this.bots.findIndex(b => b.id === id)
          if (index >= 0) {
            this.bots[index] = response.data
          }
          this.success = 'Bot updated successfully'
          return response.data
        } else {
          this.error = response.message || 'Failed to update bot'
          return null
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to update bot'
        console.error('Error updating bot:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async deleteBot(id: number) {
      this.loading = true
      this.error = null
      this.success = null
      
      try {
        const response = await $fetch<ApiResponse<boolean>>(`/api/prisma/bots/${id}`, {
          method: 'DELETE'
        })
        
        if (response.success) {
          const index = this.bots.findIndex(b => b.id === id)
          if (index >= 0) {
            this.bots.splice(index, 1)
          }
          this.success = 'Bot deleted successfully'
          return true
        } else {
          this.error = response.message || 'Failed to delete bot'
          return false
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to delete bot'
        console.error('Error deleting bot:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    // Builder actions
    updateBuilderForm(field: keyof BotForm, value: string) {
      this.builderForm[field] = value
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
        prompt: this.builderForm.prompt, // Keep default prompt
        model: '',
        memory: '4000',
        tools: 'file_search,codebase_search,read_file,edit_file,run_terminal_cmd,web_search,grep_search'
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
        const botData = {
          name: this.builderForm.name,
          description: `Bot created via builder: ${this.builderForm.name}`,
          status: 'inactive' as const,
          config: {
            prompt: this.builderForm.prompt,
            model: this.builderForm.model,
            memory: parseInt(this.builderForm.memory),
            tools: this.builderForm.tools.split(',').map(t => t.trim())
          }
        }

        const result = await this.createBot(botData)
        if (result) {
          this.resetBuilder()
          return true
        }
        return false
      } catch (error) {
        console.error('Error submitting bot:', error)
        return false
      }
    },

    // Validation actions
    validateField(field: keyof BotForm) {
      switch (field) {
        case 'name':
          this.validationErrors.name = this.builderForm.name.trim() === '' ? 'Name is required' : ''
          break
        case 'prompt':
          this.validationErrors.prompt = this.builderForm.prompt.trim() === '' ? 'Prompt is required' : ''
          break
        case 'model':
          this.validationErrors.model = this.builderForm.model.trim() === '' ? 'Model is required' : ''
          break
      }
    },

    validateAllFields() {
      this.validateField('name')
      this.validateField('prompt')
      this.validateField('model')
    },

    clearValidationErrors() {
      this.validationErrors = {
        name: '',
        prompt: '',
        model: ''
      }
    },

    // Test actions
    async sendTestMessage(botId: number, message: string) {
      if (!message.trim()) return

      const userMessage: BotTestMessage = {
        id: Date.now(),
        role: 'user',
        text: message,
        timestamp: new Date()
      }

      this.testMessages.push(userMessage)
      this.testInput = ''
      this.testSteps = []
      this.testProgress = 0

      try {
        const response = await $fetch(`/api/bots/${botId}/test`, {
          method: 'POST',
          body: { message }
        })

        if (response.response) {
          const botMessage: BotTestMessage = {
            id: Date.now() + 1,
            role: 'bot',
            text: response.response,
            timestamp: new Date()
          }
          this.testMessages.push(botMessage)
        }

        if (Array.isArray(response.steps)) {
          this.testSteps = response.steps.map((step: any) => ({
            name: step.name,
            status: 'pending' as const,
            result: undefined
          }))
          this.simulateTestProgress()
        }
      } catch (error) {
        const errorMessage: BotTestMessage = {
          id: Date.now() + 1,
          role: 'bot',
          text: 'Error contacting bot API.',
          timestamp: new Date()
        }
        this.testMessages.push(errorMessage)
      }
    },

    simulateTestProgress() {
      let current = 0
      const updateStep = () => {
        if (current > 0) {
          this.testSteps[current - 1].status = 'complete'
          this.testSteps[current - 1].result = `Step '${this.testSteps[current - 1].name}' completed.`
        }
        if (current < this.testSteps.length) {
          this.testSteps[current].status = 'running'
          this.testSteps[current].result = `Step '${this.testSteps[current].name}' started.`
          this.testProgress = ((current + 1) / this.testSteps.length) * 100
          current++
          setTimeout(updateStep, 1200)
        } else {
          this.testProgress = 100
        }
      }

      if (this.testSteps.length > 0) {
        this.testSteps[0].status = 'running'
        this.testSteps[0].result = `Step '${this.testSteps[0].name}' started.`
        setTimeout(updateStep, 1200)
      }
    },

    resetTest() {
      this.testMessages = []
      this.testSteps = []
      this.testProgress = 0
      this.testInput = ''
    },

    updateTestInput(input: string) {
      this.testInput = input
    },

    // Utility actions
    clearError() {
      this.error = null
    },

    clearSuccess() {
      this.success = null
    }
  }
}) 