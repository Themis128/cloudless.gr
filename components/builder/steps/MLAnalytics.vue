<template>
  <div class="ml-analytics-step">
    <v-card class="step-card" :class="{ 'step-card--configured': isConfigured }">
      <v-card-title class="d-flex align-center">
        <v-icon color="purple" class="me-2"> mdi-brain </v-icon>
        <div>
          <h4 class="text-h6 font-weight-medium">ML Analytics</h4>
          <p class="text-caption text-medium-emphasis mb-0">Apply machine learning models</p>
        </div>
        <v-spacer />
        <v-chip
          :color="isConfigured ? 'success' : 'warning'"
          :prepend-icon="isConfigured ? 'mdi-check' : 'mdi-alert'"
          size="small"
          variant="tonal"
        >
          {{ isConfigured ? 'Ready' : 'Configure' }}
        </v-chip>
      </v-card-title>

      <v-card-text>
        <!-- Model Selection -->
        <div class="model-selection mb-4">
          <h5 class="text-subtitle-2 mb-3">Model Configuration</h5>

          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="localData.problemType"
                :items="problemTypes"
                label="Problem Type"
                variant="outlined"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="localData.selectedModel"
                :items="availableModels"
                label="ML Algorithm"
                variant="outlined"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Model Parameters -->
        <div v-if="localData.selectedModel" class="model-parameters mb-4">
          <h5 class="text-subtitle-2 mb-3">Model Parameters</h5>

          <v-expansion-panels variant="accordion">
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon class="me-2">mdi-tune</v-icon>
                Hyperparameters
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-row>
                  <v-col
                    v-for="param in modelParameters"
                    :key="param.name"
                    cols="12"
                    md="6"
                  >
                    <v-text-field
                      v-if="param.type === 'number'"
                      v-model.number="localData.parameters[param.name]"
                      :label="param.label"
                      :type="param.type"
                      :min="param.min"
                      :max="param.max"
                      variant="outlined"
                      density="compact"
                      @update:model-value="updateData"
                    />
                    <v-select
                      v-else-if="param.type === 'select'"
                      v-model="localData.parameters[param.name]"
                      :items="'options' in param ? param.options : []"
                      :label="param.label"
                      variant="outlined"
                      density="compact"
                      @update:model-value="updateData"
                    />
                    <v-switch
                      v-else-if="param.type === 'boolean'"
                      v-model="localData.parameters[param.name]"
                      :label="param.label"
                      density="compact"
                      @update:model-value="updateData"
                    />
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon class="me-2">mdi-target</v-icon>
                Training Configuration
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-slider
                      v-model="localData.trainTestSplit"
                      label="Train/Test Split (%)"
                      min="50"
                      max="90"
                      step="5"
                      thumb-label
                      @update:model-value="updateData"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="localData.crossValidation"
                      :items="cvOptions"
                      label="Cross Validation"
                      variant="outlined"
                      density="compact"
                      @update:model-value="updateData"
                    />
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>

        <!-- Training Status -->
        <div v-if="trainingStatus" class="training-status mt-4">
          <h5 class="text-subtitle-2 mb-3">Training Progress</h5>

          <v-progress-linear
            :model-value="trainingProgress"
            color="purple"
            height="8"
            class="mb-3"
          />

          <v-row>
            <v-col
              v-for="metric in trainingMetrics"
              :key="metric.name"
              cols="6"
              md="3"
            >
              <v-card variant="outlined" class="text-center pa-3">
                <div class="text-h6 font-weight-bold">{{ metric.value }}</div>
                <div class="text-caption text-medium-emphasis">{{ metric.name }}</div>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <!-- Model Results -->
        <div v-if="modelResults" class="model-results mt-4">
          <h5 class="text-subtitle-2 mb-3">Model Performance</h5>

          <v-row>
            <v-col cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1"> Performance Metrics </v-card-title>
                <v-card-text>
                  <v-list density="compact">
                    <v-list-item
                      v-for="metric in performanceMetrics"
                      :key="metric.name"
                      :title="metric.name"
                      :subtitle="metric.value"
                    >
                      <template #append>
                        <v-chip :color="metric.color" size="small" variant="tonal">
                          {{ metric.score }}
                        </v-chip>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1"> Feature Importance </v-card-title>
                <v-card-text>
                  <div v-for="feature in featureImportance" :key="feature.name" class="mb-2">
                    <div class="d-flex justify-space-between align-center mb-1">
                      <span class="text-body-2">{{ feature.name }}</span>
                      <span class="text-caption">{{ feature.importance }}%</span>
                    </div>
                    <v-progress-linear
                      :model-value="feature.importance"
                      color="purple"
                      height="4"
                    />
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-play"
          :loading="training"
          :disabled="!isConfigured"
          @click="trainModel"
        >
          Train Model
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-test-tube"
          :disabled="!modelResults"
          @click="validateModel"
        >
          Validate
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-download"
          :disabled="!modelResults"
          @click="exportModel"
        >
          Export Model
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

// Props
const props = defineProps<{
  data: Record<string, any>;
  index?: number;
  previewMode?: boolean;
}>();

// Emits
const emit = defineEmits(['update', 'validate']);

// Reactive state
const localData = ref({
  problemType: 'classification',
  selectedModel: '',
  parameters: {} as Record<string, any>,
  trainTestSplit: 80,
  crossValidation: '5-fold',
  ...props.data,
});

const training = ref(false);
const trainingStatus = ref<Record<string, any> | null>(null);
const trainingProgress = ref(0);
const modelResults = ref<Record<string, any> | null>(null);

// Configuration options
const problemTypes = [
  { title: 'Classification', value: 'classification' },
  { title: 'Regression', value: 'regression' },
  { title: 'Clustering', value: 'clustering' },
  { title: 'Time Series', value: 'timeseries' },
];

const availableModels = computed(() => {
  const models = {
    classification: [
      { title: 'Random Forest', value: 'random_forest' },
      { title: 'Support Vector Machine', value: 'svm' },
      { title: 'Logistic Regression', value: 'logistic' },
      { title: 'Neural Network', value: 'neural_network' },
    ],
    regression: [
      { title: 'Linear Regression', value: 'linear' },
      { title: 'Random Forest Regressor', value: 'rf_regressor' },
      { title: 'Gradient Boosting', value: 'gradient_boosting' },
      { title: 'Neural Network', value: 'neural_network' },
    ],
    clustering: [
      { title: 'K-Means', value: 'kmeans' },
      { title: 'DBSCAN', value: 'dbscan' },
      { title: 'Hierarchical', value: 'hierarchical' },
    ],
  };
  return models[localData.value.problemType as keyof typeof models] || [];
});

const modelParameters = computed(() => {
  const params = {
    random_forest: [
      { name: 'n_estimators', label: 'Number of Trees', type: 'number', min: 10, max: 1000 },
      { name: 'max_depth', label: 'Max Depth', type: 'number', min: 1, max: 50 },
    ],
    svm: [
      { name: 'C', label: 'Regularization', type: 'number', min: 0.01, max: 100 },
      { name: 'kernel', label: 'Kernel', type: 'select', options: ['rbf', 'linear', 'poly'] },
    ],
    neural_network: [
      { name: 'hidden_layers', label: 'Hidden Layers', type: 'number', min: 1, max: 10 },
      { name: 'learning_rate', label: 'Learning Rate', type: 'number', min: 0.001, max: 1 },
    ],
  };
  return params[localData.value.selectedModel as keyof typeof params] || [];
});

const cvOptions = [
  { title: '3-Fold CV', value: '3-fold' },
  { title: '5-Fold CV', value: '5-fold' },
  { title: '10-Fold CV', value: '10-fold' },
  { title: 'Stratified CV', value: 'stratified' },
];

// Mock data
const trainingMetrics = ref([
  { name: 'Accuracy', value: '94.2%' },
  { name: 'Precision', value: '91.8%' },
  { name: 'Recall', value: '96.1%' },
  { name: 'F1-Score', value: '93.9%' },
]);

const performanceMetrics = ref([
  { name: 'Accuracy', value: '94.2%', score: 'Excellent', color: 'success' },
  { name: 'Precision', value: '91.8%', score: 'Good', color: 'success' },
  { name: 'Recall', value: '96.1%', score: 'Excellent', color: 'success' },
  { name: 'F1-Score', value: '93.9%', score: 'Excellent', color: 'success' },
]);

const featureImportance = ref([
  { name: 'Age', importance: 85 },
  { name: 'Income', importance: 72 },
  { name: 'Location', importance: 45 },
  { name: 'Education', importance: 38 },
]);

// Computed
const isConfigured = computed(() => {
  return localData.value.problemType && localData.value.selectedModel;
});

// Methods
const updateData = () => {
  emit('update', { ...localData.value });
  emit('validate', isConfigured.value);
};

const trainModel = async () => {
  training.value = true;
  trainingStatus.value = {};

  try {
    // Simulate training progress
    for (let progress = 0; progress <= 100; progress += 10) {
      trainingProgress.value = progress;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    modelResults.value = {
      accuracy: 94.2,
      trained: true,
      modelSize: '2.3MB',
    };
  } catch (error) {
    console.error('Training failed:', error);
  } finally {
    training.value = false;
  }
};

const validateModel = () => {
  console.log('Validating model...');
  // Implementation for model validation
};

const exportModel = () => {
  console.log('Exporting model...');
  // Implementation for model export
};

// Watchers
watch(
  () => props.data,
  (newData) => {
    localData.value = { ...localData.value, ...newData };
  },
  { deep: true },
);

watch(
  localData,
  () => {
    updateData();
  },
  { deep: true },
);

// Initialize validation
updateData();
</script>

<style scoped>
.ml-analytics-step {
  width: 100%;
}

.step-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.step-card--configured {
  border-color: rgba(156, 39, 176, 0.3);
}

.training-status,
.model-results {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}
</style>
