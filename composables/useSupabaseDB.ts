/**
 * Enhanced Supabase composable with typed operations and error handling
 * Organized with namespaced operations for better IDE support and clarity
 */
import type {
  Database,
  Project,
  TrainingSession,
  ModelVersion,
  Deployment
} from '~/types/supabase.d'

export function useSupabaseDB() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  // Helper function for error handling
  const handleError = (error: any, operation: string) => {
    console.error(`Supabase ${operation} error:`, error)
    throw error
  }

  // Projects operations
  const projects = {    // Get all projects for current user
    async getAll() {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', user.value.id)
        .order('updated_at', { ascending: false })

      if (error) handleError(error, 'projects.getAll')
      return data || []
    },    // Get single project by ID
    async getById(id: string) {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (error) handleError(error, 'projects.getById')
      return data
    },

    // Create new project
    async create(projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('projects')
        .insert([{
          ...projectData,
          owner_id: user.value.id
        }])
        .select()
        .single()

      if (error) handleError(error, 'projects.create')
      return data
    },

    // Update project
    async update(id: string, updates: Partial<Project>) {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', user.value.id)
        .select()
        .single()

      if (error) handleError(error, 'projects.update')
      return data
    },

    // Delete project
    async delete(id: string) {
      if (!user.value) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.value.id)

      if (error) handleError(error, 'projects.delete')
      return true
    }
  }
  // Training sessions operations
  const trainingSessions = {
    // Get training sessions for a project
    async getByProject(projectId: string) {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) handleError(error, 'trainingSessions.getByProject')
      return data || []
    },

    // Create training session
    async create(sessionData: {
      project_id: string
      name: string
      config: Record<string, any>
      pipeline_id?: string
    }) {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('training_sessions')
        .insert([{
          ...sessionData,
          owner_id: user.value.id,
          status: 'pending'
        }])
        .select()
        .single()

      if (error) handleError(error, 'trainingSessions.create')
      return data
    },

    // Update training session
    async update(id: string, updates: Partial<TrainingSession>) {
      const { data, error } = await supabase
        .from('training_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) handleError(error, 'trainingSessions.update')
      return data
    },

    // Start training session
    async start(id: string) {
      const { data, error } = await supabase
        .from('training_sessions')
        .update({
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) handleError(error, 'trainingSessions.start')
      return data
    },

    // Stop training session
    async stop(id: string) {
      const { data, error } = await supabase
        .from('training_sessions')
        .update({
          status: 'stopped',
          completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) handleError(error, 'trainingSessions.stop')
      return data
    },

    // Complete training session
    async complete(id: string, finalMetrics?: Record<string, any>) {
      const { data, error } = await supabase
        .from('training_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metrics: finalMetrics || {}
        })
        .eq('id', id)
        .select()
        .single()

      if (error) handleError(error, 'trainingSessions.complete')
      return data
    },

    // Delete training session
    async delete(id: string) {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id)

      if (error) handleError(error, 'trainingSessions.delete')
      return true
    }
  }
  // Training metrics operations
  const trainingMetrics = {
    // Add metrics for a training session (store in training_sessions.metrics)
    async add(sessionId: string, epoch: number, metrics: Record<string, any>) {
      // Get current metrics
      const { data: session } = await supabase
        .from('training_sessions')
        .select('metrics')
        .eq('id', sessionId)
        .single()

      const existingMetrics = session?.metrics as Record<string, any> || {}
      const updatedMetrics = {
        ...existingMetrics,
        epochs: {
          ...existingMetrics.epochs,
          [epoch]: metrics
        }
      }

      const { data, error } = await supabase
        .from('training_sessions')
        .update({ metrics: updatedMetrics })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) handleError(error, 'trainingMetrics.add')
      return data
    },

    // Get metrics for a training session
    async getBySession(sessionId: string) {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('metrics')
        .eq('id', sessionId)
        .single()

      if (error) handleError(error, 'trainingMetrics.getBySession')
      const metrics = data?.metrics as Record<string, any> || {}
      return metrics.epochs ?? {}
    }
  }

  // Model versions operations
  const modelVersions = {
    // Get model versions for a project
    async getByProject(projectId: string) {
      const { data, error } = await supabase
        .from('model_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) handleError(error, 'modelVersions.getByProject')
      return data || []
    },

    // Create model version
    async create(versionData: {
      project_id: string
      training_session_id?: string
      name: string
      version_tag: string
      description?: string
      artifact_url?: string
      config?: Record<string, any>
      metrics?: Record<string, any>
    }) {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('model_versions')
        .insert([{
          project_id: versionData.project_id,
          training_session_id: versionData.training_session_id ?? null,
          owner_id: user.value.id,
          name: versionData.name,
          version_tag: versionData.version_tag,
          description: versionData.description ?? null,
          artifact_url: versionData.artifact_url ?? null,
          config: versionData.config || {},
          metrics: versionData.metrics || {}
        }])
        .select()
        .single()

      if (error) handleError(error, 'modelVersions.create')
      return data
    },

    // Update model version
    async update(id: string, updates: Partial<ModelVersion>) {
      const { data, error } = await supabase
        .from('model_versions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) handleError(error, 'modelVersions.update')
      return data
    }
  }

  // Deployments operations
  const deployments = {
    // Get deployments for a project
    async getByProject(projectId: string) {
      const { data, error } = await supabase
        .from('deployments')
        .select(`
          *,
          model_versions(name, version_tag)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) handleError(error, 'deployments.getByProject')
      return data || []
    },

    // Create deployment
    async create(deploymentData: {
      project_id: string
      model_version_id: string
      name: string
      environment: 'development' | 'staging' | 'production'
      config: Record<string, any>
    }) {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('deployments')
        .insert([{
          ...deploymentData,
          owner_id: user.value.id,
          status: 'pending'
        }])
        .select()
        .single()

      if (error) handleError(error, 'deployments.create')
      return data
    },

    // Update deployment
    async update(id: string, updates: Partial<Deployment>) {
      const { data, error } = await supabase
        .from('deployments')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) handleError(error, 'deployments.update')
      return data
    },

    // Deploy (start deployment)
    async deploy(id: string, endpointUrl?: string) {
      const { data, error } = await supabase
        .from('deployments')
        .update({
          status: 'running',
          deployed_at: new Date().toISOString(),
          endpoint_url: endpointUrl
        })
        .eq('id', id)
        .select()
        .single()

      if (error) handleError(error, 'deployments.deploy')
      return data
    },

    // Stop deployment
    async stop(id: string) {
      const { data, error } = await supabase
        .from('deployments')
        .update({
          status: 'stopped',
          stopped_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) handleError(error, 'deployments.stop')
      return data
    },

    // Delete deployment
    async delete(id: string) {
      const { error } = await supabase
        .from('deployments')
        .delete()
        .eq('id', id)

      if (error) handleError(error, 'deployments.delete')
      return true
    }
  }

  // User profile operations
  const userProfile = {
    // Get current user profile
    async get() {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()

      if (error) handleError(error, 'userProfile.get')
      return data
    },

    // Update user profile
    async update(updates: {
      full_name?: string
      avatar_url?: string
      preferences?: Record<string, any>
    }) {
      if (!user.value) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.value.id)
        .select()
        .single()

      if (error) handleError(error, 'userProfile.update')
      return data
    },

    // Create user profile (usually called automatically via trigger)
    async create(profileData: {
      id: string
      full_name?: string
      avatar_url?: string
      role?: 'admin' | 'user' | 'viewer'
    }) {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([{
          id: profileData.id,
          full_name: profileData.full_name ?? null,
          avatar_url: profileData.avatar_url ?? null,
          role: profileData.role ?? 'user'
        }])
        .select()
        .single()

      if (error) handleError(error, 'userProfile.create')
      return data
    }
  }

  // Real-time subscriptions
  const subscriptions = {
    // Subscribe to project changes
    subscribeToProject(projectId: string, callback: (payload: any) => void) {
      return supabase
        .channel(`project:${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${projectId}`
          },
          callback
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'training_sessions',
            filter: `project_id=eq.${projectId}`
          },
          callback
        ).subscribe()
    },

    // Subscribe to training session changes
    subscribeToTrainingSession(sessionId: string, callback: (payload: any) => void) {
      return supabase
        .channel(`training:${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'training_sessions',
            filter: `id=eq.${sessionId}`
          },
          callback
        )
        .subscribe()
    }
  }

  return {
    projects,
    trainingSessions,
    trainingMetrics,
    modelVersions,
    deployments,
    userProfile,
    subscriptions,
    supabase, // Raw client for custom queries
    user
  }
}
