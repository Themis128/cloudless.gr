import { ref } from 'vue'
import type { Bot } from '~/types/Bot'

export function useBotBuilder(template?: Partial<Bot>) {
  const form = ref({
    name: template?.name || '',
    prompt: template?.prompt || '',
    model: template?.model || '',
    memory: template?.memory || '',
    tools: template?.tools || ''
  })
  const step = ref(0)
  const steps = ref([
    { title: 'Details', subtitle: 'Bot name & prompt', icon: 'mdi-robot', description: 'Enter the bot name and prompt.' },
    { title: 'Model', subtitle: 'Select model', icon: 'mdi-brain', description: 'Choose the model for your bot.' },
    { title: 'Settings', subtitle: 'Memory & tools', icon: 'mdi-cog', description: 'Configure memory and tools.' },
    { title: 'Summary', subtitle: 'Review', icon: 'mdi-check', description: 'Review your bot setup.' },
  ])
  const progressValue = ref(((step.value + 1) / steps.value.length) * 100)
  function nextStep() { if (step.value < steps.value.length - 1) step.value++ }
  function prevStep() { if (step.value > 0) step.value-- }
  function goToStep(idx: number) { step.value = idx }
  function isStepComplete(idx: number) { return idx < step.value }
  function submitBot() { /* implement bot creation logic */ }

  return {
    form, step, steps, progressValue,
    nextStep, prevStep, goToStep, isStepComplete, submitBot
  }
}
