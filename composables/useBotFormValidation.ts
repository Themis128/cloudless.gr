import { ref, Ref } from 'vue'

export function useBotFormValidation(form: Ref<{ name: string; prompt: string; model: string; memory?: string; tools?: string }>) {
  const nameError = ref('')
  const promptError = ref('')
  const modelError = ref('')

  function validateName() {
    nameError.value = form.value.name.trim() === '' ? 'Name is required' : ''
  }
  function validatePrompt() {
    promptError.value = form.value.prompt.trim() === '' ? 'Prompt is required' : ''
  }
  function validateModel() {
    modelError.value = form.value.model.trim() === '' ? 'Model is required' : ''
  }

  return { nameError, promptError, modelError, validateName, validatePrompt, validateModel }
}
