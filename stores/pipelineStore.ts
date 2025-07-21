import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Pipeline, PipelineConfig } from '~/types/Pipeline'
import type { Json } from '~/types/database.types'

export const usePipelineStore = defineStore('pipeline', () => {
  const pipelines = ref<any[]>([])
  const currentPipeline = ref<Pipeline | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const supabase = useSupabase()

  const create = async (payload: {
    name: string
    config: PipelineConfig
    description?: string
    model?: string
    project_id: string
  }) => {
    loading.value = true
    error.value = null

    try {
      const { data: userData } = await supabase.auth.getUser()
      const owner_id = userData?.user?.id
      if (!owner_id) throw new Error('User not authenticated')

      const { data, error: err } = await supabase
        .from('pipelines')
        .insert({
          name: payload.name,
          config: payload.config as unknown as Json,
          description: payload.description,
          model: payload.model,
          project_id: payload.project_id,
          owner_id,
          created_at: new Date().toISOString(),
          is_active: true,
          version: 1,
        })
        .select()
        .single()

      if (err) throw err

      if (data) {
        const pipeline = {
          ...data,
          config: data.config as unknown as PipelineConfig,
        } as Pipeline

        pipelines.value.unshift(pipeline)
        currentPipeline.value = pipeline
      }

      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      return { success: false, error: err }
    } finally {
      loading.value = false
    }
  }

  const fetchAll = async () => {
    loading.value = true
    error.value = null

    try {
      const { data, error: err } = await supabase
        .from('pipelines')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err

      pipelines.value = (data || []).map((p: any) => {
        return {
          ...p,
          config: p.config as PipelineConfig,
        }
      })

      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      pipelines.value = []
      return { success: false, error: err }
    } finally {
      loading.value = false
    }
  }

  const update = async (id: string, updates: Partial<Pipeline>) => {
    loading.value = true
    error.value = null

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      }

      if (updateData.config) {
        updateData.config = updateData.config as unknown as Json
      }

      const { data, error: err } = await supabase
        .from('pipelines')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (err) throw err

      if (data) {
        const pipeline = {
          ...data,
          config: data.config as unknown as PipelineConfig,
        } as Pipeline

        const index = pipelines.value.findIndex(p => p.id === id)
        if (index !== -1) {
          pipelines.value[index] = pipeline
        }
        if (currentPipeline.value?.id === id) {
          currentPipeline.value = pipeline
        }
      }

      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      return { success: false, error: err }
    } finally {
      loading.value = false
    }
  }

  const remove = async (id: string) => {
    loading.value = true
    error.value = null

    try {
      const { error: err } = await supabase
        .from('pipelines')
        .delete()
        .eq('id', id)

      if (err) throw err

      pipelines.value = pipelines.value.filter(p => p.id !== id)
      if (currentPipeline.value?.id === id) {
        currentPipeline.value = null
      }

      return { success: true }
    } catch (err: any) {
      error.value = err.message
      return { success: false, error: err }
    } finally {
      loading.value = false
    }
  }

  return {
    pipelines,
    currentPipeline,
    loading,
    error,
    create,
    fetchAll,
    update,
    remove,
  }
})
