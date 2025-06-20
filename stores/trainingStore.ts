import type { TrainingConfig, TrainingMetrics, TrainingSession } from '@/types/project';

export const useTrainingStore = defineStore('training', () => {
  // State
  const trainingSessions = ref<TrainingSession[]>([]);
  const activeTrainingSessions = ref<TrainingSession[]>([]);
  const trainingHistory = ref<TrainingSession[]>([]);
  const currentProjectId = ref<string>('');

  // Loading states
  const loading = ref(false);
  const training = ref(false);
  const stopping = ref(false);

  // Computed
  const isTraining = computed(() => training.value);
  const activeSessions = computed(() => activeTrainingSessions.value);
  const completedSessions = computed(() => trainingHistory.value);
  const totalSessions = computed(() => trainingSessions.value.length);

  // Actions
  const setCurrentProject = (projectId: string) => {
    currentProjectId.value = projectId;
  };

  const fetchTrainingSessions = async (projectId?: string): Promise<TrainingSession[]> => {
    const targetProjectId = projectId || currentProjectId.value;
    if (!targetProjectId) {
      console.warn('No project ID provided for fetchTrainingSessions');
      return [];
    }

    try {
      loading.value = true;
      const supabase = useSupabaseClient() as any;

      const { data, error } = await supabase
        .from('training_sessions')
        .select(
          `
          *,
          model_versions (
            id,
            version,
            project_id
          )
        `,
        )
        .eq('model_versions.project_id', targetProjectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching training sessions:', error);
        return [];
      }

      trainingSessions.value = data || [];

      // Separate active and historical sessions
      activeTrainingSessions.value = trainingSessions.value.filter(
        (s) => s.status === 'running' || s.status === 'training' || s.status === 'starting',
      );
      trainingHistory.value = trainingSessions.value.filter(
        (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'stopped',
      );

      return trainingSessions.value;
    } catch (error) {
      console.error('Error in fetchTrainingSessions:', error);
      return [];
    } finally {
      loading.value = false;
    }
  };

  const startTraining = async (
    modelVersionId: string,
    config: TrainingConfig,
    name: string,
  ): Promise<TrainingSession | null> => {
    try {
      training.value = true;
      const supabase = useSupabaseClient() as any;

      const { data, error } = await supabase
        .from('training_sessions')
        .insert({
          model_version_id: modelVersionId,
          name,
          config,
          status: 'starting',
        })
        .select()
        .single();

      if (error) {
        console.error('Error starting training:', error);
        return null;
      }

      // Add to active sessions
      activeTrainingSessions.value.unshift(data);
      trainingSessions.value.unshift(data);

      return data;
    } catch (error) {
      console.error('Error in startTraining:', error);
      return null;
    } finally {
      training.value = false;
    }
  };

  const updateTrainingStatus = async (
    sessionId: string,
    status: string,
    progress?: number,
    metrics?: TrainingMetrics,
  ): Promise<boolean> => {
    try {
      const supabase = useSupabaseClient() as any;

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (progress !== undefined) {
        updateData.progress = progress;
      }

      if (metrics) {
        updateData.metrics = metrics;
      }

      const { error } = await supabase
        .from('training_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating training status:', error);
        return false;
      }

      // Update local state
      const session = trainingSessions.value.find((s) => s.id === sessionId);
      if (session) {
        session.status = status;
        session.updated_at = updateData.updated_at;
        if (progress !== undefined) {
          session.progress = progress;
        }
        if (metrics) {
          session.metrics = metrics;
        }

        // Move between active and history based on status
        if (status === 'running' || status === 'training') {
          const historyIndex = trainingHistory.value.findIndex((s) => s.id === sessionId);
          if (historyIndex !== -1) {
            trainingHistory.value.splice(historyIndex, 1);
            activeTrainingSessions.value.push(session);
          }
        } else if (status === 'completed' || status === 'failed' || status === 'stopped') {
          const activeIndex = activeTrainingSessions.value.findIndex((s) => s.id === sessionId);
          if (activeIndex !== -1) {
            activeTrainingSessions.value.splice(activeIndex, 1);
            trainingHistory.value.unshift(session);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error in updateTrainingStatus:', error);
      return false;
    }
  };

  const stopTraining = async (sessionId: string): Promise<boolean> => {
    try {
      stopping.value = true;
      return await updateTrainingStatus(sessionId, 'stopped');
    } finally {
      stopping.value = false;
    }
  };

  const deleteTrainingSession = async (sessionId: string): Promise<boolean> => {
    try {
      const supabase = useSupabaseClient() as any;

      const { error } = await supabase.from('training_sessions').delete().eq('id', sessionId);

      if (error) {
        console.error('Error deleting training session:', error);
        return false;
      }

      // Remove from all local arrays
      const sessionIndex = trainingSessions.value.findIndex((s) => s.id === sessionId);
      if (sessionIndex !== -1) {
        trainingSessions.value.splice(sessionIndex, 1);
      }

      const activeIndex = activeTrainingSessions.value.findIndex((s) => s.id === sessionId);
      if (activeIndex !== -1) {
        activeTrainingSessions.value.splice(activeIndex, 1);
      }

      const historyIndex = trainingHistory.value.findIndex((s) => s.id === sessionId);
      if (historyIndex !== -1) {
        trainingHistory.value.splice(historyIndex, 1);
      }

      return true;
    } catch (error) {
      console.error('Error in deleteTrainingSession:', error);
      return false;
    }
  };

  const getTrainingLogs = async (sessionId: string): Promise<string[]> => {
    try {
      // In a real implementation, this would fetch logs from your logging service
      // For now, return mock logs
      return [
        `[${new Date().toISOString()}] Training session ${sessionId} started`,
        `[${new Date().toISOString()}] Loading dataset...`,
        `[${new Date().toISOString()}] Dataset loaded successfully`,
        `[${new Date().toISOString()}] Starting training...`,
        `[${new Date().toISOString()}] Epoch 1/10 - Loss: 0.8523`,
        `[${new Date().toISOString()}] Epoch 2/10 - Loss: 0.7234`,
        `[${new Date().toISOString()}] Epoch 3/10 - Loss: 0.6891`,
      ];
    } catch (error) {
      console.error('Error fetching training logs:', error);
      return [];
    }
  };

  const validateTrainingConfig = (config: TrainingConfig): boolean => {
    if (!config.algorithm) {
      console.error('Training algorithm is required');
      return false;
    }

    if (!config.dataset_config?.source) {
      console.error('Dataset source is required');
      return false;
    }

    if (!config.dataset_config?.features?.length) {
      console.error('Dataset features are required');
      return false;
    }

    if (!config.dataset_config?.target) {
      console.error('Dataset target is required');
      return false;
    }

    return true;
  };

  // Utility functions
  const clearStoreData = () => {
    trainingSessions.value = [];
    activeTrainingSessions.value = [];
    trainingHistory.value = [];
    currentProjectId.value = '';
  };

  return {
    // State
    trainingSessions: readonly(trainingSessions),
    activeTrainingSessions: readonly(activeTrainingSessions),
    trainingHistory: readonly(trainingHistory),
    currentProjectId: readonly(currentProjectId),

    // Loading states
    loading: readonly(loading),
    training: readonly(training),
    stopping: readonly(stopping),

    // Computed
    isTraining,
    activeSessions,
    completedSessions,
    totalSessions,

    // Actions
    setCurrentProject,
    fetchTrainingSessions,
    startTraining,
    updateTrainingStatus,
    stopTraining,
    deleteTrainingSession,
    getTrainingLogs,
    validateTrainingConfig,
    clearStoreData,
  };
});
