import { computed } from 'vue'

export function usePromptHelp() {
  return computed(() =>
    'Write a clear and concise prompt that describes the bot’s purpose, behavior, and any special instructions. Example: "You are a helpful assistant that answers questions about cloud infrastructure."'
  )
}
