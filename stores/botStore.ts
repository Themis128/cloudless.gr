import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Bot } from '~/types/Bot'

export const useBotStore = defineStore('bot', () => {
  const name = ref('')
  const loading = ref(false)
  const success = ref(false)
  const error = ref<string | null>(null)
  const bots = ref<Bot[]>([])
  const supabase = useSupabase()

  const create = async (payload: {
    name: string
    prompt?: string
    model?: string
    memory?: string
    tools?: string
  }) => {
    loading.value = true
    success.value = false
    error.value = null
    const { error: err } = await supabase.from('bots').insert({
      name: payload.name,
      prompt: payload.prompt ?? '',
      model: payload.model ?? '',
      memory: payload.memory ?? '',
      tools: payload.tools ?? '',
      created_at: new Date().toISOString(),
    })
    loading.value = false
    if (err) {
      error.value = err.message
    } else {
      success.value = true
      name.value = ''
      await fetchAll() // Refresh list after create
    }
  }

  const fetchAll = async () => {
    loading.value = true
    error.value = null
    const { data, error: err } = await supabase
      .from('bots')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) {
      error.value = err.message
      bots.value = []
    } else {
      bots.value = (data || []).map((bot: any) => ({
        id: bot.id,
        name: bot.name,
        prompt: bot.prompt ?? '',
        created_at: bot.created_at,
        user_id: bot.user_id,
        avatar_url: bot.avatar_url,
        is_active: bot.is_active,
        model: bot.model,
        template_type: bot.template_type,
      }))
    }
    loading.value = false
  }

  return { name, loading, success, error, bots, create, fetchAll }
})
