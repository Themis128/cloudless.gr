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
  data: Record<string, unknown>;
  index?: number;
  previewMode?: boolean;
}>();

// Emits
const emit = defineEmits<{
  update: [data: Record<string, unknown>];
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

type ValidationResults = {
  qualityScore: number;
  completeness: number;
  accuracy: number;
  consistency: number;
};

type ValidationIssue = {
  id: number;
  severity: 'warning' | 'error';
  message: string;
  details: string;
  fixable: boolean;
  column?: string;
};

const validationResults = ref<ValidationResults | null>(null);
const validationIssues = ref<ValidationIssue[]>([]);
let issueId = 1;

// Helper: get tabular data from props.dataSource or props.data
const getData = (): Array<Record<string, unknown>> => {
  // Accepts either a 'dataSource' prop or expects tabular data in props.data.dataSource
  const dataSource = (props.data as Record<string, unknown>)?.dataSource;
  if (Array.isArray(dataSource)) {
    return dataSource as Array<Record<string, unknown>>;
  }
  if (Array.isArray(props.data)) {
    return props.data as Array<Record<string, unknown>>;
  }
  return [];
};

// Validation logic
const validateData = () => {
  const data = getData();
  const issues: ValidationIssue[] = [];
  let totalCells = 0;
  let missingCells = 0;
  let typeErrors = 0;
  let duplicateRows = 0;
  let outlierCells = 0;
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  const seenRows = new Set<string>();

  // Check for missing values
  if (localData.value.checkMissingValues) {
    columns.forEach((col) => {
      let colMissing = 0;
      data.forEach((row) => {
        totalCells++;
        if (row[col] === null || row[col] === undefined || row[col] === '') {
          missingCells++;
          colMissing++;
        }
      });
      if (colMissing > 0) {
        issues.push({
          id: issueId++,
          severity: 'warning',
          message: 'Missing values detected',
          details: `${((colMissing / data.length) * 100).toFixed(1)}% of values in column "${col}" are missing`,
          fixable: true,
          column: col,
        });
      }
    });
  }

  // Check for duplicates
  if (localData.value.checkDuplicates) {
    data.forEach((row) => {
      const key = JSON.stringify(row);
      if (seenRows.has(key)) {
        duplicateRows++;
      } else {
        seenRows.add(key);
      }
    });
    if (duplicateRows > 0) {
      issues.push({
        id: issueId++,
        severity: 'warning',
        message: 'Duplicate rows detected',
        details: `${duplicateRows} duplicate rows found`,
        fixable: true,
      });
    }
  }

  // Check for data type errors (assume numeric columns should be numbers)
  if (localData.value.validateDataTypes) {
    columns.forEach((col) => {
      let colTypeErrors = 0;
      // Heuristic: if >80% of values are numbers, treat as numeric column
      const values = data.map((row) => row[col]);
      const numCount = values.filter((v) => typeof v === 'number' && !isNaN(v as number)).length;
      if (numCount / data.length > 0.8) {
        values.forEach((v) => {
          if (v !== null && v !== undefined && typeof v !== 'number') {
            typeErrors++;
            colTypeErrors++;
          }
        });
        if (colTypeErrors > 0) {
          issues.push({
            id: issueId++,
            severity: 'error',
            message: 'Invalid data type',
            details: `${colTypeErrors} non-numeric values in column "${col}"`,
            fixable: true,
            column: col,
          });
        }
      }
    });
  }

  // Check for outliers (z-score method)
  if (localData.value.checkOutliers) {
    columns.forEach((col) => {
      const values = data.map((row) => row[col]).filter((v) => typeof v === 'number') as number[];
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
        values.forEach((v) => {
          if (Math.abs((v - mean) / (std || 1)) > localData.value.outlierThreshold) {
            outlierCells++;
          }
        });
        if (outlierCells > 0) {
          issues.push({
            id: issueId++,
            severity: 'warning',
            message: 'Outliers detected',
            details: `${outlierCells} outliers in column "${col}"`,
            fixable: false,
            column: col,
          });
        }
      }
    });
  }

  // Compute metrics
  const completeness = totalCells > 0 ? 100 - (missingCells / totalCells) * 100 : 100;
  const accuracy = totalCells > 0 ? 100 - (typeErrors / totalCells) * 100 : 100;
  const consistency = duplicateRows > 0 ? 100 - (duplicateRows / data.length) * 100 : 100;
  // Quality score: average of metrics
  const qualityScore = (completeness + accuracy + consistency) / 3;

  validationResults.value = {
    qualityScore: Math.round(qualityScore),
    completeness: Math.round(completeness),
    accuracy: Math.round(accuracy),
    consistency: Math.round(consistency),
  };
  validationIssues.value = issues;
};

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
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
    validateData();
  } finally {
    validating.value = false;
  }
};

const fixIssue = async (issue: ValidationIssue) => {
  const data = getData();
  if (issue.message === 'Missing values detected' && issue.column) {
    // Fill missing values with median for numeric, mode for string
    const col = issue.column;
    const values = data.map((row) => row[col]).filter((v) => v !== null && v !== undefined && v !== '');
    let fillValue: unknown = '';
    if (values.length > 0 && typeof values[0] === 'number') {
      // Median
      const nums = (values as number[]).sort((a, b) => a - b);
      fillValue = nums[Math.floor(nums.length / 2)];
    } else {
      // Mode
      const freq: Record<string, number> = {};
      (values as string[]).forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
      fillValue = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    }
    data.forEach((row) => {
      if (row[col] === null || row[col] === undefined || row[col] === '') {
        row[col] = fillValue;
      }
    });
  } else if (issue.message === 'Duplicate rows detected') {
    // Remove duplicate rows
    const seen = new Set<string>();
    for (let i = data.length - 1; i >= 0; i--) {
      const key = JSON.stringify(data[i]);
      if (seen.has(key)) {
        data.splice(i, 1);
      } else {
        seen.add(key);
      }
    }
  } else if (issue.message === 'Invalid data type' && issue.column) {
    // Attempt to coerce values to number
    const col = issue.column;
    data.forEach((row) => {
      if (typeof row[col] !== 'number') {
        const num = Number(row[col]);
        if (!isNaN(num)) row[col] = num;
      }
    });
  }
  // Remove the fixed issue
  const index = validationIssues.value.findIndex((i) => i.id === issue.id);
  if (index > -1) {
    validationIssues.value.splice(index, 1);
  }
  // Re-run validation to update issues/metrics
  validateData();
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
