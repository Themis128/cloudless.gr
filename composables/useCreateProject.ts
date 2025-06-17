import { ref } from 'vue'

export const useCreateProject = () => {
  const supabase = useSupabaseClient<any>()
  const user = useSupabaseUser()
  
  const loading = ref(false)
  const error = ref<string | null>(null)

  const createProject = async (projectData: {
    name: string
    description?: string
    type: 'cv' | 'nlp' | 'regression' | 'recommendation' | 'time-series' | 'custom'
    framework?: string
    config?: Record<string, any>
  }) => {
    try {
      loading.value = true
      error.value = null

      if (!user.value) {
        throw new Error('User must be authenticated to create projects')
      }      // Prepare the project data
      const projectPayload = {
        name: projectData.name,
        description: projectData.description ?? null,
        type: projectData.type,
        framework: projectData.framework ?? null,
        config: projectData.config || {},
        owner_id: user.value.id
      }      // Insert project into the database
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert([projectPayload] as any)
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create project: ${insertError.message}`)
      }

      // Also create a profile record if it doesn't exist
      try {        const { error: profileError } = await supabase
          .from('profiles')
          .upsert([{
            id: user.value.id,
            role: 'user',
            updated_at: new Date().toISOString()
          }] as any)

        if (profileError) {
          console.warn('Could not create/update profile:', profileError.message)
        }
      } catch (profileErr) {
        console.warn('Profile creation failed:', profileErr)
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  return {
    createProject,
    loading: readonly(loading),
    error: readonly(error)
  }
}
