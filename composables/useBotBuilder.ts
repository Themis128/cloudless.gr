import { ref } from 'vue'
import type { Bot } from '~/types/Bot'
import { useBotStore } from '~/stores/botStore'

export function useBotBuilder(template?: Partial<Bot>) {
  const form = ref({
    name: template?.name || '',
    prompt: template?.prompt || `You are a highly capable AI development assistant. Your role is to help with coding tasks, debugging, and development workflows.

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
    model: template?.model || '',
    memory: template?.memory || '4000', // Default 4K context window
    tools: template?.tools || 'file_search,codebase_search,read_file,edit_file,run_terminal_cmd,web_search,grep_search' // Default essential tools
  })
  const step = ref(0)
  const steps = ref([
    { title: 'Details', subtitle: 'Bot name & prompt', icon: 'mdi-robot', description: 'Enter the bot name and prompt.<br><br><strong>Default Prompt:</strong> Pre-configured with comprehensive development assistant instructions covering code analysis, problem solving, and best practices.' },
    { title: 'Model', subtitle: 'Select model', icon: 'mdi-brain', description: 'Choose the model for your bot.' },
    { title: 'Settings', subtitle: 'Memory & tools', icon: 'mdi-cog', description: 'Configure memory and tools settings.<br><br><strong>Memory Context:</strong> Default is 4000 tokens for optimal context retention.<br><strong>Tools:</strong> Pre-configured with essential development tools for code search, file operations, and web searches.' },
    { title: 'Summary', subtitle: 'Review', icon: 'mdi-check', description: 'Review your bot setup.' },
  ])
  const progressValue = ref(((step.value + 1) / steps.value.length) * 100)
  
  const botStore = useBotStore()

  function nextStep() { if (step.value < steps.value.length - 1) step.value++ }
  function prevStep() { if (step.value > 0) step.value-- }
  function goToStep(idx: number) { step.value = idx }
  function isStepComplete(idx: number) { return idx < step.value }
  
  async function submitBot() {
    try {
      await botStore.create({
        name: form.value.name,
        prompt: form.value.prompt,
        model: form.value.model,
        memory: form.value.memory,
        tools: form.value.tools
      })
      return true
    } catch (err) {
      console.error('Error creating bot:', err)
      return false
    }
  }

  return {
    form, step, steps, progressValue,
    nextStep, prevStep, goToStep, isStepComplete, submitBot
  }
}
