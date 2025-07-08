<template>
  <div class="training-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="breadcrumb-nav">
        <!-- ...existing code... -->
      </div> <!-- Close breadcrumb-nav properly -->
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-2"
        @click="$router.back()"
      >
        Back
      </v-btn>

    </div> <!-- Close .page-header -->
  </div> <!-- Close .training-page -->
</template>


<script setup lang="ts">

import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, definePageMeta } from '#imports';
import { useProjectsStore } from '@/stores/projectsStore';
import type { TrainingConfig, TrainingMetrics } from '~/types/project';

// Types for trained models and comparison metrics
interface TrainedModel {
  id: string;
  name: string;
  version: string;
  accuracy: number;
  loss: number;
  created_at: string;
}

interface ComparisonMetric {
  modelId: string;
  metric: string;
  value: number;
}

definePageMeta({ layout: 'projects' });

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
const projectsStore = useProjectsStore();


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
  validation: {
    method: 'holdout',
    parameters: {},
  },
  parameters: {},
  dataset_config: {
    source: 'dataset.csv',
    features: ['feature1', 'feature2'],
    target: 'label',
    split_ratio: 0.8,
  },
});

const trainingHistory = ref<TrainingSessionUI[]>([]);
const trainedModels = ref<TrainedModel[]>([]);
const comparisonMetrics = ref<ComparisonMetric[]>([]);
const historyLoading = ref(false);
const modelsLoading = ref(false);
const trainingSession = ref<TrainingSessionUI | null>(null);



const loadTrainingHistory = async () => {
  try {
    historyLoading.value = true;
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

