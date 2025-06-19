<template>
  <div class="training-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="breadcrumb-nav">
        <v-btn
          variant="text"
          prepend-icon="mdi-arrow-left"
          class="mb-2"
          @click="navigateTo(`/projects/${route.params.id}`)"
        >
          Back to Pipeline
        </v-btn>
      </div>

      <div class="header-content">
        <div class="project-info">
          <v-avatar :color="getProjectColor(project?.type)" size="48" class="me-4">
            <v-icon :icon="getProjectIcon(project?.type)" color="white" />
          </v-avatar>
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">{{ project?.name || 'Loading...' }}</h1>
            <p class="text-body-1 text-medium-emphasis mb-2">Model Training & Optimization</p>
            <v-chip
              v-if="project"
              :color="getStatusColor(project.status)"
              :prepend-icon="getStatusIcon(project.status)"
              size="small"
              variant="tonal"
            >
              {{
                (project.status || 'unknown').charAt(0).toUpperCase() +
                (project.status || 'unknown').slice(1)
              }}
            </v-chip>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <v-container fluid class="px-6">
      <v-row>
        <!-- Training Configuration -->
        <v-col cols="12" md="4">
          <v-card class="training-config-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-cog" class="me-2" />
              Training Configuration
            </v-card-title>
            <v-divider />
            <v-card-text>
              <TrainingConfigForm
                :project-id="route.params.id as string"
                :loading="configLoading"
                @submit="updateTrainingConfig"
              />
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Training Progress & Results -->
        <v-col cols="12" md="8">
          <v-row>
            <!-- Training Status -->
            <v-col cols="12">
              <v-card class="training-status-card">
                <v-card-title class="d-flex align-center justify-space-between">
                  <div class="d-flex align-center">
                    <v-icon icon="mdi-progress-check" class="me-2" />
                    Training Status
                  </div>
                  <v-btn
                    v-if="!trainingSession?.isActive"
                    color="primary"
                    prepend-icon="mdi-play"
                    :disabled="!canStartTraining"
                    :loading="startingTraining"
                    @click="startTraining"
                  >
                    Start Training
                  </v-btn>
                  <v-btn
                    v-else
                    color="error"
                    prepend-icon="mdi-stop"
                    :loading="stoppingTraining"
                    @click="stopTraining"
                  >
                    Stop Training
                  </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <TrainingProgress
                    :session="trainingSession"
                    :metrics="trainingMetrics"
                    :project-id="route.params.id as string"
                    @stop="stopTraining"
                    @refresh="() => {}"
                  />
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Training History -->
            <v-col cols="12">
              <v-card class="training-history-card">
                <v-card-title class="d-flex align-center">
                  <v-icon icon="mdi-history" class="me-2" />
                  Training History
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <TrainingHistoryTable
                    :sessions="trainingHistory"
                    :loading="historyLoading"
                    @view-session="viewTrainingSession"
                    @delete-session="deleteTrainingSession"
                  />
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- Model Comparison -->
      <v-row class="mt-4">
        <v-col cols="12">
          <v-card class="model-comparison-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-compare" class="me-2" />
              Model Comparison
            </v-card-title>
            <v-divider />
            <v-card-text>
              <ModelComparisonChart
                :models="trainedModels"
                :metrics="comparisonMetrics"
                :loading="modelsLoading"
                @view-model="(model) => console.log('View model:', model)"
                @download-model="(model) => console.log('Download model:', model)"
                @deploy-model="(model) => navigateTo(`/projects/${route.params.id}/deploy`)"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import type { Project, TrainingConfig, TrainingMetrics, TrainingSession } from '~/types/project';

// Page meta
definePageMeta({
  middleware: 'auth',
  layout: 'default',
});

// Composables
const route = useRoute();
const { getProjectIcon, getProjectColor, getStatusIcon, getStatusColor } = useIcons();
const { fetchProject } = useFetchProjects();

// Reactive state
const project = ref<Project | null>(null);
const trainingConfig = ref<TrainingConfig>({
  algorithm: 'neural_network',
  epochs: 100,
  batch_size: 32,
  learningRate: 0.001,
  validationSplit: 0.2,
  earlyStoppingPatience: 10,
  optimizerType: 'adam',
  lossFunction: 'categorical_crossentropy',
  metrics: ['accuracy', 'loss'],
  regularization: {
    type: 'l2',
    value: 0.01,
  },
  dataAugmentation: false,
  crossValidation: false,
});

const trainingSession = ref<TrainingSession | null>(null);
const trainingMetrics = ref<TrainingMetrics[]>([]);
const trainingHistory = ref<TrainingSession[]>([]);
const trainedModels = ref([]);
const comparisonMetrics = ref([]);

// Loading states
const configLoading = ref(false);
const startingTraining = ref(false);
const stoppingTraining = ref(false);
const historyLoading = ref(false);
const modelsLoading = ref(false);

// Computed
const canStartTraining = computed(() => {
  return project.value && trainingConfig.value && !trainingSession.value?.isActive;
});

// Methods
const updateTrainingConfig = async (config: TrainingConfig) => {
  try {
    configLoading.value = true;
    // TODO: Update training configuration in Supabase
    console.log('Updating training config:', config);

    // Placeholder API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    trainingConfig.value = { ...config };
  } catch (error) {
    console.error('Failed to update training config:', error);
  } finally {
    configLoading.value = false;
  }
};

const startTraining = async () => {
  try {
    startingTraining.value = true;

    // TODO: Start training session via Supabase/API
    console.log('Starting training with config:', trainingConfig.value);

    // Placeholder API call
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Mock training session
    trainingSession.value = {
      id: `session_${Date.now()}`,
      project_id: route.params.id as string,
      owner_id: 'mock-user-id', // TODO: Get from auth
      name: `Training Session ${Date.now()}`,
      status: 'running',
      config: trainingConfig.value,
      progress: 0,
      metrics: {},
      logs: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Additional properties for UI
      currentEpoch: 0,
      totalEpochs: trainingConfig.value.epochs,
    } as any;

    // Start monitoring training progress
    monitorTrainingProgress();
  } catch (error) {
    console.error('Failed to start training:', error);
  } finally {
    startingTraining.value = false;
  }
};

const stopTraining = async () => {
  try {
    stoppingTraining.value = true;

    // TODO: Stop training session via API
    console.log('Stopping training session:', trainingSession.value?.id);

    // Placeholder API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (trainingSession.value) {
      trainingSession.value.isActive = false;
      trainingSession.value.status = 'stopped';
      trainingSession.value.completed_at = new Date().toISOString();
    }
  } catch (error) {
    console.error('Failed to stop training:', error);
  } finally {
    stoppingTraining.value = false;
  }
};

const monitorTrainingProgress = () => {
  // TODO: Implement real-time training monitoring
  // This would typically connect to a WebSocket or poll an API

  const interval = setInterval(() => {
    if (!trainingSession.value?.isActive) {
      clearInterval(interval);
      return;
    }

    // Mock progress update
    if (trainingSession.value.currentEpoch < trainingSession.value.totalEpochs) {
      trainingSession.value.currentEpoch += 1;
      trainingSession.value.progress =
        (trainingSession.value.currentEpoch / trainingSession.value.totalEpochs) * 100;

      // Mock metrics
      trainingMetrics.value.push({
        epoch: trainingSession.value.currentEpoch,
        loss: Math.random() * 0.5 + 0.1,
        accuracy: Math.random() * 0.3 + 0.7,
        valLoss: Math.random() * 0.6 + 0.2,
        valAccuracy: Math.random() * 0.25 + 0.65,
        timestamp: new Date(),
      });
    } else {
      // Training completed
      trainingSession.value.isActive = false;
      trainingSession.value.status = 'completed';
      trainingSession.value.endedAt = new Date();
      clearInterval(interval);
    }
  }, 2000); // Update every 2 seconds (mock)
};

const viewTrainingSession = (session: TrainingSession) => {
  // TODO: Open training session details modal or navigate to detail view
  console.log('Viewing training session:', session);
};

const deleteTrainingSession = async (sessionId: string) => {
  try {
    // TODO: Delete training session from Supabase
    console.log('Deleting training session:', sessionId);

    // Placeholder API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Remove from history
    trainingHistory.value = trainingHistory.value.filter((s) => s.id !== sessionId);
  } catch (error) {
    console.error('Failed to delete training session:', error);
  }
};

const loadTrainingHistory = async () => {
  try {
    historyLoading.value = true;

    // TODO: Fetch training history from Supabase
    console.log('Loading training history for project:', route.params.id);

    // Placeholder API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock training history
    trainingHistory.value = [
      {
        id: 'session_1',
        projectId: route.params.id as string,
        status: 'completed',
        startedAt: new Date(Date.now() - 86400000),
        endedAt: new Date(Date.now() - 82800000),
        config: trainingConfig.value,
        isActive: false,
        progress: 100,
        currentEpoch: 100,
        totalEpochs: 100,
        finalMetrics: {
          loss: 0.15,
          accuracy: 0.92,
          valLoss: 0.18,
          valAccuracy: 0.89,
        },
      },
    ];
  } catch (error) {
    console.error('Failed to load training history:', error);
  } finally {
    historyLoading.value = false;
  }
};

const loadTrainedModels = async () => {
  try {
    modelsLoading.value = true;

    // TODO: Fetch trained models from Supabase
    console.log('Loading trained models for project:', route.params.id);

    // Placeholder API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock trained models data
    trainedModels.value = [];
    comparisonMetrics.value = [];
  } catch (error) {
    console.error('Failed to load trained models:', error);
  } finally {
    modelsLoading.value = false;
  }
};

// Lifecycle
onMounted(async () => {
  const projectId = route.params.id as string;

  try {
    // Load project data
    project.value = await fetchProject(projectId);

    // Load training-related data
    await Promise.all([loadTrainingHistory(), loadTrainedModels()]);
  } catch (error) {
    console.error('Failed to load training page data:', error);
  }
});

// Cleanup
onUnmounted(() => {
  // Stop any ongoing training monitoring
  if (trainingSession.value?.isActive) {
    trainingSession.value.isActive = false;
  }
});
</script>

<style scoped>
.training-page {
  min-height: 100vh;
  background-color: rgb(var(--v-theme-surface));
}

.page-header {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-secondary)) 100%
  );
  color: white;
  padding: 2rem 0;
  margin-bottom: 2rem;
}

.page-header .v-btn {
  color: rgba(255, 255, 255, 0.8);
}

.page-header .v-btn:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.project-info {
  display: flex;
  align-items: center;
}

.training-config-card,
.training-status-card,
.training-history-card,
.model-comparison-card {
  height: 100%;
  transition: all 0.2s ease-in-out;
}

.training-config-card:hover,
.training-status-card:hover,
.training-history-card:hover,
.model-comparison-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

@media (max-width: 960px) {
  .page-header {
    padding: 1rem 0;
  }

  .header-content {
    padding: 0 1rem;
  }

  .project-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>
