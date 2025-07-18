import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

export const useModelStore = defineStore('model', {
  state: () => ({
    models: [] as string[],
    activeModel: '' as string,
    status: '' as 'idle' | 'training' | 'deployed',
  }),
  actions: {
    setActive(model: string) {
      this.activeModel = model
    },
    updateStatus(newStatus: 'idle' | 'training' | 'deployed') {
      this.status = newStatus
    },
  },
})

export const useTrainingStore = defineStore('training', () => {
  const modelName = ref('')
  const dataUrl = ref('')
  const loading = ref(false)
  const success = ref(false)
  const error = ref<string | null>(null)
  const supabase = useSupabase()

  const train = async (payload: {
    name: string
    config: { dataUrl: string }
  }) => {
    loading.value = true
    success.value = false
    error.value = null
    const { error: err } = await supabase
      .from('training_sessions')
      .insert([payload])
    if (err) {
      error.value = err.message
    } else {
      success.value = true
      modelName.value = ''
      dataUrl.value = ''
    }
    loading.value = false
  }

  return { modelName, dataUrl, loading, success, error, train }
})
