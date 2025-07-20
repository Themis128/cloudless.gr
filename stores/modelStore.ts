import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Tables } from '~/types/database.types'

type Model = Tables<'models'>
type ModelVersion = Tables<'model_versions'>
type TrainingSession = Tables<'training_sessions'>

export const useModelStore = defineStore('model', () => {
  const models = ref<Model[]>([])
  const modelVersions = ref<ModelVersion[]>([])
  const trainingSessions = ref<TrainingSession[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const supabase = useSupabase()

  const fetchAll = async () => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: err } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      models.value = data || []
    } catch (err: any) {
      error.value = err.message
      models.value = []
    } finally {
      loading.value = false
    }
  }

  const fetchModelVersions = async () => {
    try {
      const { data, error: err } = await supabase
        .from('model_versions')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      modelVersions.value = data || []
    } catch (err: any) {
      error.value = err.message
      modelVersions.value = []
    }
  }

  const fetchTrainingSessions = async () => {
    try {
      const { data, error: err } = await supabase
        .from('training_sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      trainingSessions.value = data || []
    } catch (err: any) {
      error.value = err.message
      trainingSessions.value = []
    }
  }

  const create = async (payload: { name: string }) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: err } = await supabase
        .from('models')
        .insert([{
          name: payload.name,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (err) throw err
      if (data) {
        models.value.unshift(data)
      }
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      return { success: false, error: err }
    } finally {
      loading.value = false
    }
  }

  return {
    models,
    modelVersions,
    trainingSessions,
    loading,
    error,
    fetchAll,
    fetchModelVersions,
    fetchTrainingSessions,
    create
  }
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
