import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

export const useBotStore = defineStore('bot', () => {
  const name = ref('')
  const loading = ref(false)
  const success = ref(false)
  const error = ref<string | null>(null)
  const supabase = useSupabase()

  async function create(payload: { name: string }) {
    loading.value = true
    success.value = false
    error.value = null
    const { error: err } = await supabase.from('bots').insert([payload])
    if (err) {
      error.value = err.message
    } else {
      success.value = true
      name.value = ''
    }
    loading.value = false
  }

  return { name, loading, success, error, create }
})
