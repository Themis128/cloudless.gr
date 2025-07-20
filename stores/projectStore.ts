import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Tables } from '~/types/database.types'

type Project = Tables<'projects'>

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const supabase = useSupabase()

  const fetchAll = async () => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: err } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      projects.value = data || []
    } catch (err: any) {
      error.value = err.message
      projects.value = []
    } finally {
      loading.value = false
    }
  }

  const create = async (payload: {
    name: string
    description?: string
    type?: string
    framework?: string
    config?: any
  }) => {
    loading.value = true
    error.value = null
    
    try {
      const { data: userData } = await supabase.auth.getUser()
      const owner_id = userData?.user?.id
      if (!owner_id) throw new Error('User not authenticated')

      const { data, error: err } = await supabase
        .from('projects')
        .insert([{
          name: payload.name,
          description: payload.description,
          type: payload.type,
          framework: payload.framework,
          config: payload.config,
          owner_id,
          status: 'draft',
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (err) throw err
      if (data) {
        projects.value.unshift(data)
        currentProject.value = data
      }
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      return { success: false, error: err }
    } finally {
      loading.value = false
    }
  }

  const update = async (id: string, updates: { name?: string; description?: string; type?: string; framework?: string; config?: any; status?: string; updated_at?: string }) => {
    loading.value = true
    error.value = null

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      }

      const { data, error: err } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (err) throw err

      if (data) {
        const index = projects.value.findIndex(p => p.id === id)
        if (index !== -1) {
          projects.value[index] = data
        }
        if (currentProject.value?.id === id) {
          currentProject.value = data
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
        .from('projects')
        .delete()
        .eq('id', id)

      if (err) throw err

      projects.value = projects.value.filter(p => p.id !== id)
      if (currentProject.value?.id === id) {
        currentProject.value = null
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
    projects,
    currentProject,
    loading,
    error,
    fetchAll,
    create,
    update,
    remove,
  }
}) 