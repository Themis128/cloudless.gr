import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

export const useTemplateStore = defineStore('template', {
  state: () => ({
    templates: [] as Array<{ name: string; content: string }>,
    selectedTemplate: null as string | null,
  }),
  actions: {
    selectTemplate(name: string) {
      this.selectedTemplate = name
    },
    addTemplate(name: string, content: string) {
      this.templates.push({ name, content })
    },
  },
})

export const useProjectStore = defineStore('project', () => {
  const name = ref('')
  const description = ref('')
  const loading = ref(false)
  const success = ref(false)
  const error = ref<string | null>(null)
  const supabase = useSupabase()

  const create = async (payload: { name: string; description: string }) => {
    loading.value = true
    success.value = false
    error.value = null
    const { error: err } = await supabase.from('projects').insert([payload])
    if (err) {
      error.value = err.message
    } else {
      success.value = true
      name.value = ''
      description.value = ''
    }
    loading.value = false
  }

  return { name, description, loading, success, error, create }
})
