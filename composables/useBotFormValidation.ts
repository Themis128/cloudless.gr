import { ref, Ref } from 'vue'

export const useBotFormValidation = (
  form: Ref<{
    name: string
    prompt: string
    model: string
    memory?: string
    tools?: string
  }>
) => {
  const nameError = ref('')
  const promptError = ref('')
  const modelError = ref('')

  const validateName = () => {
    nameError.value = form.value.name.trim() === '' ? 'Name is required' : ''
  }
  const validatePrompt = () => {
    promptError.value =
      form.value.prompt.trim() === '' ? 'Prompt is required' : ''
  }
  const validateModel = () => {
    modelError.value = form.value.model.trim() === '' ? 'Model is required' : ''
  }

  return {
    nameError,
    promptError,
    modelError,
    validateName,
    validatePrompt,
    validateModel,
  }
}
