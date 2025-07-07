<template>
  <div class="training-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="breadcrumb-nav">
        <v-btn
          variant="text"
          prepend-icon="mdi-arrow-left"
          class="mb-2"
          @click="router.push(`/projects/${route.params.id}`)"
        >
          Back to Pipeline
        </v-btn>
      </div>

      <div class="header-content">
        <div class="project-info">
          <v-avatar
            color="success"
            size="48"
            class="me-4"
            aria-label="User initials avatar"
          >
            <span class="text-h6 font-weight-bold">{{ project?.name?.charAt(0) || 'U' }}</span>
          </v-avatar>
          <div>
            <h1 class="text-h4 mb-1">{{ project?.name || 'Training' }}</h1>
            <p class="text-body-1 opacity-90">Train and optimize your machine learning models</p>
          </div>
        </div>
      </div>
    </div>

    <v-container class="py-8">
      <v-row>
        <!-- Training Configuration -->
        <v-col cols="12" lg="4">
          <v-card class="training-config-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-cog" class="me-2" />
              Training Configuration
            </v-card-title>
            <v-divider />
            <v-card-text>
              <TrainingConfigForm
                :config="trainingConfig"
                :loading="configLoading"
                @update="updateTrainingConfig"
              />
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" lg="8">
          <v-row>
            <!-- Training Status -->
            <v-col cols="12">
              <v-card class="training-status-card">
                <v-card-title class="d-flex align-center">
                  <v-icon icon="mdi-play-circle" class="me-2" />
                  Training Status
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <TrainingStatusCard
                    :session="trainingSession"
                    :metrics="trainingMetrics"
                    :can-start="canStartTraining"
                    :starting="startingTraining"
                    :stopping="stoppingTraining"
                    @start="startTraining"
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
                @view-model="(model: any) => console.log('View model:', model)"
                @download-model="(model: any) => console.log('Download model:', model)"
                @deploy-model="(model: any) => router.push(`/projects/${route.params.id}/deploy`)"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { definePageMeta } from '#imports';
definePageMeta({ layout: 'projects', middleware: 'auth' })

import { useProjectsStore } from '@/stores/projectsStore';
import type { TrainingConfig, TrainingMetrics } from '~/types/project';
import type { ComparisonMetric, TrainedModel } from '~/types/training';

// Simplified UI type to avoid deep type instantiation issues
interface TrainingSessionUI {
  id: string;
  project_id: string;
  name: string;
  status: string;
  config: TrainingConfig;
  progress?: number;
  metrics?: TrainingMetrics;
  logs?: string | null;
  started_at?: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  isActive?: boolean;
  currentEpoch?: number;
  totalEpochs?: number;
}
const route = useRoute();
const router = useRouter();
const projectsStore = useProjectsStore();
// const trainingStore = useTrainingStore();
// Use trainingStore.sessions, trainingStore.fetchTrainingSessions, trainingStore.startTraining, etc.

// Reactive state
const project = computed(() => projectsStore.getProjectById(route.params.id as string));
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
  parameters: {},
  dataset_config: {
    source: 'default',
    features: [],
    target: '',
  },
  validation: {
    method: 'holdout',
    parameters: {},
  },
});

const trainingSession = ref<TrainingSessionUI | null>(null);
const trainingMetrics = ref<TrainingMetrics[]>([]);
const trainingHistory = ref<TrainingSessionUI[]>([]);
const trainedModels = ref<TrainedModel[]>([]);
const comparisonMetrics = ref<ComparisonMetric[]>([]);

// Loading states
const configLoading = ref(false);
const startingTraining = ref(false);
const stoppingTraining = ref(false);
const historyLoading = ref(false);
const modelsLoading = ref(false);

// Computed
const canStartTraining = computed(() => {
  return project.value && trainingConfig.value && !(trainingSession.value?.isActive);
});

// Methods
const updateTrainingConfig = async (config: TrainingConfig) => {
  try {
    configLoading.value = true;
    console.log('Updating training config:', config);
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
    console.log('Starting training with config:', trainingConfig.value);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    trainingSession.value = {
      id: `session_${Date.now()}`,
      project_id: route.params.id as string,
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
      isActive: true,
      currentEpoch: 0,
      totalEpochs: trainingConfig.value.epochs,
    };

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
    console.log('Stopping training session:', trainingSession.value?.id);
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
  const interval = setInterval(() => {
    if (!trainingSession.value?.isActive) {
      clearInterval(interval);
      return;
    }

    const session = trainingSession.value;
    if (
      typeof session?.currentEpoch === 'number' &&
      typeof session?.totalEpochs === 'number' &&
      session.currentEpoch < session.totalEpochs
    ) {
      session.currentEpoch += 1;
      session.progress = (session.currentEpoch / session.totalEpochs) * 100;

      trainingMetrics.value.push({
        epoch: session.currentEpoch,
        loss: Math.random() * 0.5 + 0.1,
        accuracy: Math.random() * 0.3 + 0.7,
      });
    } else {
      if (session) {
        session.isActive = false;
        session.status = 'completed';
        session.completed_at = new Date().toISOString();
      }
      clearInterval(interval);
    }
  }, 2000);
};

const viewTrainingSession = (session: TrainingSessionUI) => {
  console.log('Viewing training session:', session);
};

const deleteTrainingSession = async (sessionId: string) => {
  try {
    console.log('Deleting training session:', sessionId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    trainingHistory.value = trainingHistory.value.filter((s) => s.id !== sessionId);
  } catch (error) {
    console.error('Failed to delete training session:', error);
  }
};

const loadTrainingHistory = async () => {
  try {
    historyLoading.value = true;
    console.log('Loading training history for project:', route.params.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    trainingHistory.value = [
      {
        id: 'session_1',
        project_id: route.params.id as string,
        name: 'Demo Training Session',
        status: 'completed',
        config: trainingConfig.value,
        progress: 100,
        metrics: {
          loss: 0.15,
          accuracy: 0.92,
        },
        logs: null,
        started_at: new Date(Date.now() - 86400000).toISOString(),
        completed_at: new Date(Date.now() - 82800000).toISOString(),
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 82800000).toISOString(),
        isActive: false,
        currentEpoch: 100,
        totalEpochs: 100,
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
    console.log('Loading trained models for project:', route.params.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Mock data for demo
    trainedModels.value = [
      {
        id: 'model_001',
        name: 'CNN Classifier',
        version: 'v1.0',
        accuracy: 0.92,
        loss: 0.18,
        created_at: new Date().toISOString(),
      },
    ];
    comparisonMetrics.value = [
      { modelId: 'model_001', metric: 'accuracy', value: 0.92 },
      { modelId: 'model_001', metric: 'loss', value: 0.18 },
    ];
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
    if (!projectsStore.getProjectById(projectId)) {
      await projectsStore.fetchProject(projectId);
    }
    await Promise.all([loadTrainingHistory(), loadTrainedModels()]);
  } catch (error) {
    console.error('Failed to load training page data:', error);
  }
});

onUnmounted(() => {
  if (trainingSession.value?.isActive) {
    trainingSession.value.isActive = false;
  }
});
</script>

<style scoped>
.training-page {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surface)) 0%,
    rgba(var(--v-theme-primary), 0.02) 100%
  );
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
  position: relative;
  overflow: hidden;
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" fill="white" opacity="0.1"><polygon points="0,100 100,0 200,50 300,0 400,70 500,20 600,80 700,10 800,60 900,0 1000,40 1000,100"/></svg>')
    repeat-x;
  background-size: 1000px 100px;
}

.page-header .v-btn {
  color: rgba(255, 255, 255, 0.9);
  border-radius: 24px;
  transition: all 0.3s ease;
}

.page-header .v-btn:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  position: relative;
  z-index: 1;
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
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-radius: 16px;
  border: 1px solid rgba(var(--v-border-color), 0.12);
  background: rgb(var(--v-theme-surface));
}

.training-config-card:hover,
.training-status-card:hover,
.training-history-card:hover,
.model-comparison-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.training-config-card .v-card-title,
.training-status-card .v-card-title,
.training-history-card .v-card-title,
.model-comparison-card .v-card-title {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.05) 0%,
    rgba(var(--v-theme-surface), 0.8) 100%
  );
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  border-radius: 16px 16px 0 0;
  font-weight: 600;
}

/* Enhanced button styling */
.v-btn {
  border-radius: 24px;
  transition: all 0.3s ease;
}

.v-btn:hover:not(.v-btn--disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* Enhanced dividers */
.v-divider {
  border-color: rgba(var(--v-border-color), 0.12);
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

  .training-config-card:hover,
  .training-status-card:hover,
  .training-history-card:hover,
  .model-comparison-card:hover {
    transform: none;
  }
}
</style>
