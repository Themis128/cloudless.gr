import { computed, readonly, ref } from 'vue'
import { useSupabase } from './supabase'

export interface TrainingConfig {
  name: string
  baseModel: string
  trainingType: 'fine-tuning' | 'full-training' | 'lora'
  description?: string
  parameters: {
    epochs: number
    batchSize: number
    learningRate: number
    useEarlyStop: boolean
  }
  trainingData: File[]
}

export interface TrainingSession {
  id: string
  name: string
  base_model: string
  training_type: string
  description?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
  progress: number
  current_epoch?: number
  total_epochs?: number
  parameters: any
  created_at: string
  started_at?: string
  completed_at?: string
  error_message?: string
  job_id?: string
  owner_id: string
}

export interface TrainingMetrics {
  id: string
  training_session_id: string
  epoch: number
  step?: number
  metrics: {
    loss?: number
    accuracy?: number
    learning_rate?: number
    validation_loss?: number
    validation_accuracy?: number
  }
  timestamp: string
}

export const useModelTrainer = () => {
  const supabase = useSupabase()
  
  // State
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentSession = ref<TrainingSession | null>(null)
  const sessions = ref<TrainingSession[]>([])
  const metrics = ref<TrainingMetrics[]>([])
  
  // Computed
  const isTraining = computed(() => 
    currentSession.value?.status === 'running' || 
    currentSession.value?.status === 'pending'
  )
  
  const trainingProgress = computed(() => 
    currentSession.value?.progress || 0
  )
  
  const currentEpoch = computed(() => 
    currentSession.value?.current_epoch || 0
  )
  
  const totalEpochs = computed(() => 
    currentSession.value?.total_epochs || 
    currentSession.value?.parameters?.epochs || 
    0
  )

  // Methods
  const startTraining = async (config: TrainingConfig): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
    loading.value = true
    error.value = null
    
    try {
      // Get current user
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // Prepare training data (in production, you'd upload to storage)
      const trainingDataInfo = config.trainingData.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      }))

      // Call training API
      const response = await $fetch('/api/models/train', {
        method: 'POST',
        body: {
          name: config.name,
          baseModel: config.baseModel,
          trainingType: config.trainingType,
          description: config.description,
          parameters: config.parameters,
          trainingData: trainingDataInfo,
          ownerId: userId
        }
      }) as any

      if (response.success) {
        // Fetch the created session
        await fetchSession(response.data.sessionId)
        return { success: true, sessionId: response.data.sessionId }
      } else {
        throw new Error('Training failed to start')
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to start training'
      error.value = errorMessage
      // console.error('Training error:', err)
      return { success: false, error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  const fetchSession = async (sessionId: string): Promise<TrainingSession | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (fetchError) throw fetchError

      currentSession.value = data as unknown as TrainingSession
      return data as unknown as TrainingSession
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch training session'
      return null
    }
  }

  const fetchAllSessions = async (): Promise<TrainingSession[]> => {
    loading.value = true
    error.value = null
    
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const { data, error: fetchError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      sessions.value = (data || []) as unknown as TrainingSession[]
      return sessions.value
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch training sessions'
      return []
    } finally {
      loading.value = false
    }
  }

  const stopTraining = async (sessionId: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('training_sessions')
        .update({ 
          status: 'stopped',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (updateError) throw updateError

      // Update current session if it's the one being stopped
      if (currentSession.value?.id === sessionId) {
        currentSession.value.status = 'stopped'
      }

      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to stop training'
      return false
    }
  }

  const deleteSession = async (sessionId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId)

      if (deleteError) throw deleteError

      // Remove from sessions list
      sessions.value = sessions.value.filter(s => s.id !== sessionId)
      
      // Clear current session if it was deleted
      if (currentSession.value?.id === sessionId) {
        currentSession.value = null
      }

      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to delete training session'
      return false
    }
  }

  const fetchMetrics = async (sessionId: string): Promise<TrainingMetrics[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('training_metrics')
        .select('*')
        .eq('training_session_id', sessionId)
        .order('epoch', { ascending: true })
        .order('step', { ascending: true })

      if (fetchError) throw fetchError

      metrics.value = (data || []) as TrainingMetrics[]
      return metrics.value
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch training metrics'
      return []
    }
  }

  const getTrainingLogs = async (sessionId: string): Promise<string[]> => {
    // In a real implementation, this would fetch logs from your logging system
    // For demo purposes, we'll generate some sample logs
    const session = await fetchSession(sessionId)
    if (!session) return []

    const logs = [
      `Training session ${session.name} initialized`,
      `Base model: ${session.base_model}`,
      `Training type: ${session.training_type}`,
      `Parameters: ${JSON.stringify(session.parameters)}`,
      `Status: ${session.status}`,
      `Progress: ${session.progress}%`
    ]

    if (session.current_epoch) {
      logs.push(`Current epoch: ${session.current_epoch}`)
    }

    if (session.error_message) {
      logs.push(`Error: ${session.error_message}`)
    }

    return logs
  }

  // Real-time updates (in production, you'd use WebSockets or Server-Sent Events)
  const subscribeToSession = (sessionId: string, callback: () => void) => {
    const channel = supabase
      .channel(`training_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'training_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload: any) => {
          const updatedSession = payload.new as TrainingSession
          currentSession.value = updatedSession
          callback()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // Utility functions
  const formatTrainingTime = (startTime: string, endTime?: string): string => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const duration = end.getTime() - start.getTime()
    
    const hours = Math.floor(duration / (1000 * 60 * 60))
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((duration % (1000 * 60)) / 1000)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'success'
      case 'running': return 'primary'
      case 'failed': return 'error'
      case 'stopped': return 'warning'
      case 'pending': return 'info'
      default: return 'grey'
    }
  }

  const validateTrainingConfig = (config: Partial<TrainingConfig>): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    if (!config.name?.trim()) {
      errors.push('Training name is required')
    }
    
    if (!config.baseModel) {
      errors.push('Base model is required')
    }
    
    if (!config.trainingType) {
      errors.push('Training type is required')
    }
    
    if (!config.trainingData || config.trainingData.length === 0) {
      errors.push('Training data is required')
    }
    
    if (config.parameters) {
      const { epochs, batchSize, learningRate } = config.parameters
      
      if (epochs < 1 || epochs > 100) {
        errors.push('Epochs must be between 1 and 100')
      }
      
      if (batchSize < 1 || batchSize > 128) {
        errors.push('Batch size must be between 1 and 128')
      }
      
      if (learningRate < 0.0001 || learningRate > 0.1) {
        errors.push('Learning rate must be between 0.0001 and 0.1')
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  return {
    // State
    loading: readonly(loading),
    error: readonly(error),
    currentSession: readonly(currentSession),
    sessions: readonly(sessions),
    metrics: readonly(metrics),
    
    // Computed
    isTraining,
    trainingProgress,
    currentEpoch,
    totalEpochs,
    
    // Methods
    startTraining,
    fetchSession,
    fetchAllSessions,
    stopTraining,
    deleteSession,
    fetchMetrics,
    getTrainingLogs,
    subscribeToSession,
    
    // Utilities
    formatTrainingTime,
    getStatusColor,
    validateTrainingConfig
  }
}
