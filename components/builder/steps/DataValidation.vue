<template>
  <div class="data-validation-step">
    <v-card class="step-card" :class="{ 'step-card--configured': isConfigured }">
      <v-card-title class="d-flex align-center">
        <v-icon color="green" class="me-2"> mdi-check-circle </v-icon>
        <div>
          <h4 class="text-h6 font-weight-medium">Data Validation</h4>
          <p class="text-caption text-medium-emphasis mb-0">Validate and clean your data</p>
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
        <!-- Validation Rules -->
        <div class="validation-rules mb-4">
          <h5 class="text-subtitle-2 mb-3">Validation Rules</h5>

          <v-row>
            <v-col cols="12" md="6">
              <v-switch
                v-model="localData.checkMissingValues"
                label="Check Missing Values"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="localData.checkDuplicates"
                label="Check Duplicates"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="localData.validateDataTypes"
                label="Validate Data Types"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="localData.checkOutliers"
                label="Check Outliers"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Data Quality Thresholds -->
        <div class="quality-thresholds mb-4">
          <h5 class="text-subtitle-2 mb-3">Quality Thresholds</h5>

          <v-row>
            <v-col cols="12" md="6">
              <v-slider
                v-model="localData.missingValueThreshold"
                label="Missing Values (%)"
                min="0"
                max="50"
                step="1"
                thumb-label
                @update:model-value="updateData"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-slider
                v-model="localData.outlierThreshold"
                label="Outlier Detection (σ)"
                min="1"
                max="5"
                step="0.5"
                thumb-label
                @update:model-value="updateData"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Validation Results -->
        <div v-if="validationResults" class="validation-results">
          <h5 class="text-subtitle-2 mb-3">Validation Results</h5>

          <v-row>
            <v-col
              v-for="metric in validationMetrics"
              :key="metric.name"
              cols="6"
              md="3"
            >
              <v-card variant="outlined" class="text-center pa-3">
                <v-icon :color="metric.color" size="24" class="mb-2">
                  {{ metric.icon }}
                </v-icon>
                <div class="text-h6 font-weight-bold">{{ metric.value }}</div>
                <div class="text-caption text-medium-emphasis">{{ metric.name }}</div>
              </v-card>
            </v-col>
          </v-row>

          <!-- Issues Found -->
          <div v-if="validationIssues.length > 0" class="mt-4">
            <h6 class="text-subtitle-2 mb-2">Issues Found</h6>
            <v-list density="compact">
              <v-list-item
                v-for="issue in validationIssues"
                :key="issue.id"
                :prepend-icon="issue.severity === 'error' ? 'mdi-alert' : 'mdi-alert-outline'"
                :title="issue.message"
                :subtitle="issue.details"
              >
                <template #prepend>
                  <v-icon :color="issue.severity === 'error' ? 'error' : 'warning'">
                    {{ issue.severity === 'error' ? 'mdi-alert' : 'mdi-alert-outline' }}
                  </v-icon>
                </template>
                <template #append>
                  <v-btn
                    v-if="issue.fixable"
                    variant="text"
                    size="small"
                    @click="fixIssue(issue)"
                  >
                    Fix
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </div>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-play"
          :loading="validating"
          @click="runValidation"
        >
          Run Validation
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-auto-fix"
          :disabled="!hasFixableIssues"
          @click="autoFix"
        >
          Auto Fix
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
const emit = defineEmits<{
  update: [data: Record<string, any>];
  validate: [valid: boolean];
}>();

// Reactive state
const localData = ref({
  checkMissingValues: true,
  checkDuplicates: true,
  validateDataTypes: true,
  checkOutliers: false,
  missingValueThreshold: 10,
  outlierThreshold: 3,
  ...props.data,
});

const validating = ref(false);
const validationResults = ref<Record<string, any> | null>(null);

// Mock validation data
const validationIssues = ref([
  {
    id: 1,
    severity: 'warning',
    message: 'Missing values detected',
    details: '5% of values in column "age" are missing',
    fixable: true,
  },
  {
    id: 2,
    severity: 'error',
    message: 'Invalid data type',
    details: 'Column "price" contains non-numeric values',
    fixable: true,
  },
]);

// Computed
const isConfigured = computed(() => {
  return (
    localData.value.checkMissingValues ||
    localData.value.checkDuplicates ||
    localData.value.validateDataTypes ||
    localData.value.checkOutliers
  );
});

const validationMetrics = computed(() => [
  {
    name: 'Quality Score',
    value: '92%',
    icon: 'mdi-star',
    color: 'success',
  },
  {
    name: 'Completeness',
    value: '95%',
    icon: 'mdi-database-check',
    color: 'success',
  },
  {
    name: 'Accuracy',
    value: '88%',
    icon: 'mdi-target',
    color: 'warning',
  },
  {
    name: 'Consistency',
    value: '94%',
    icon: 'mdi-sync',
    color: 'success',
  },
]);

const hasFixableIssues = computed(() => {
  return validationIssues.value.some((issue) => issue.fixable);
});

// Methods
const updateData = () => {
  emit('update', { ...localData.value });
  emit('validate', isConfigured.value);
};

const runValidation = async () => {
  validating.value = true;

  try {
    // Mock validation process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    validationResults.value = {
      qualityScore: 92,
      completeness: 95,
      accuracy: 88,
      consistency: 94,
    };
  } catch (error) {
    console.error('Validation failed:', error);
  } finally {
    validating.value = false;
  }
};

const fixIssue = async (issue: any) => {
  console.log('Fixing issue:', issue.message);
  // Mock fix process
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Remove the fixed issue
  const index = validationIssues.value.findIndex((i) => i.id === issue.id);
  if (index > -1) {
    validationIssues.value.splice(index, 1);
  }
};

const autoFix = async () => {
  const fixableIssues = validationIssues.value.filter((issue) => issue.fixable);

  for (const issue of fixableIssues) {
    await fixIssue(issue);
  }
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
.data-validation-step {
  width: 100%;
}

.step-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.step-card--configured {
  border-color: rgba(76, 175, 80, 0.3);
}

.validation-results {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

.quality-thresholds {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}
</style>
