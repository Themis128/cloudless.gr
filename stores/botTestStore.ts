import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface TestMessage {
  id: number
  role: string
  text: string
}

interface TestStep {
  name: string
  status: 'pending' | 'running' | 'complete' | 'error'
  result?: string
  [key: string]: any
}

export const useBotTestStore = defineStore('botTest', () => {
  // State
  const input = ref('')
  const messages = ref<TestMessage[]>([])
  const steps = ref<TestStep[]>([])
  const progress = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentBotId = ref<string | number | null>(null)
  let msgId = 1

  // Computed properties
  const hasMessages = computed(() => messages.value.length > 0)
  const hasSteps = computed(() => steps.value.length > 0)
  const isTestComplete = computed(() => progress.value === 100)
  const canSendMessage = computed(
    () => input.value.trim().length > 0 && !isLoading.value
  )

  // Actions
  const setBotId = (botId: string | number) => {
    currentBotId.value = botId
  }

  const setInput = (value: string) => {
    input.value = value
  }

  const addMessage = (role: string, text: string) => {
    messages.value.push({ id: msgId++, role, text })
  }

  const updateStep = (index: number, updates: Partial<TestStep>) => {
    if (index >= 0 && index < steps.value.length) {
      steps.value[index] = { ...steps.value[index], ...updates }
    }
  }

  const simulateStepProgress = (steps: TestStep[], userMsg: string) => {
    let current = 0

    const updateStepProgress = () => {
      if (current > 0) {
        updateStep(current - 1, {
          status: 'complete',
          result: `Step '${steps[current - 1].name}' completed.`,
        })
      }

      if (current < steps.length) {
        updateStep(current, {
          status: 'running',
          result: `Step '${steps[current].name}' started.`,
        })
        progress.value = ((current + 1) / steps.length) * 100
        current++
        setTimeout(updateStepProgress, 1200)
      } else {
        progress.value = 100
      }
    }

    // Initialize all steps to pending except first
    steps.forEach((step, idx) => {
      updateStep(idx, {
        status: idx === 0 ? 'running' : 'pending',
        result:
          idx === 0
            ? `Step '${step.name}' started with input: ${userMsg}`
            : undefined,
      })
    })

    setTimeout(updateStepProgress, 1200)
  }

  const sendMessage = async (botId?: string | number) => {
    const targetBotId = botId || currentBotId.value
    if (!targetBotId || !input.value.trim()) return

    const userMsg = input.value
    addMessage('user', userMsg)
    input.value = ''
    steps.value = []
    progress.value = 0
    isLoading.value = true
    error.value = null

    try {
      const res = await fetch(`/api/bots/${targetBotId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })

      const data = await res.json()

      if (data.response) {
        addMessage('bot', data.response)
      } else {
        addMessage('bot', data.error || 'No response from bot.')
      }

      if (Array.isArray(data.steps)) {
        steps.value = data.steps.map((s: any) => ({ ...s }))
        simulateStepProgress(steps.value, userMsg)
      }
    } catch (err: any) {
      error.value = 'Error contacting bot API.'
      addMessage('bot', 'Error contacting bot API.')
    } finally {
      isLoading.value = false
    }
  }

  const reset = () => {
    messages.value = []
    steps.value = []
    progress.value = 0
    input.value = ''
    error.value = null
    isLoading.value = false
    msgId = 1
  }

  const clearMessages = () => {
    messages.value = []
    msgId = 1
  }

  const clearSteps = () => {
    steps.value = []
    progress.value = 0
  }

  const clearError = () => {
    error.value = null
  }

  const setError = (errorMessage: string) => {
    error.value = errorMessage
  }

  return {
    // State
    input,
    messages,
    steps,
    progress,
    isLoading,
    error,
    currentBotId,

    // Computed
    hasMessages,
    hasSteps,
    isTestComplete,
    canSendMessage,

    // Actions
    setBotId,
    setInput,
    addMessage,
    updateStep,
    sendMessage,
    reset,
    clearMessages,
    clearSteps,
    clearError,
    setError,
  }
})
