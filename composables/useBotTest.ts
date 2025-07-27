import { computed } from 'vue'

// Composable that uses the Pinia store
export const useBotTest = (botId: string | number) => {
  const botTestStore = useBotTestStore()

  // Set the bot ID when composable is initialized
  botTestStore.setBotId(botId)

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    input: computed({
      get: () => botTestStore.input,
      set: (value: string) => botTestStore.setInput(value)
    }),
    messages: computed(() => botTestStore.messages),
    steps: computed(() => botTestStore.steps),
    progress: computed(() => botTestStore.progress),

    // Methods (delegate to store)
    sendMessage: () => botTestStore.sendMessage(botId),
    reset: botTestStore.reset,
    
    // Additional store methods
    clearMessages: botTestStore.clearMessages,
    clearSteps: botTestStore.clearSteps,
    clearError: botTestStore.clearError,
    setError: botTestStore.setError,
    
    // Computed properties from store
    hasMessages: computed(() => botTestStore.hasMessages),
    hasSteps: computed(() => botTestStore.hasSteps),
    isTestComplete: computed(() => botTestStore.isTestComplete),
    canSendMessage: computed(() => botTestStore.canSendMessage),
    isLoading: computed(() => botTestStore.isLoading),
    error: computed(() => botTestStore.error),
  }
}
