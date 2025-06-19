<template>
  <div class="data-input-step">
    <v-card class="step-card" :class="{ 'step-card--configured': isConfigured }">
      <v-card-title class="d-flex align-center">
        <v-icon color="blue" class="me-2"> mdi-database-import </v-icon>
        <div>
          <h4 class="text-h6 font-weight-medium">Data Input</h4>
          <p class="text-caption text-medium-emphasis mb-0">Configure your data sources</p>
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
        <!-- Data Source Type Selection -->
        <v-select
          v-model="localData.sourceType"
          :items="sourceTypes"
          label="Data Source Type"
          variant="outlined"
          density="compact"
          class="mb-4"
          @update:model-value="updateData"
        />

        <!-- File Upload -->
        <div v-if="localData.sourceType === 'file'">
          <v-file-input
            v-model="localData.files"
            label="Upload Data Files"
            variant="outlined"
            density="compact"
            multiple
            accept=".csv,.json,.xlsx,.parquet"
            prepend-icon="mdi-file-upload"
            class="mb-3"
            @update:model-value="updateData"
          />

          <v-alert
            v-if="localData.files && localData.files.length > 0"
            type="info"
            variant="tonal"
            density="compact"
          >
            {{ localData.files.length }} file(s) selected
          </v-alert>
        </div>

        <!-- Database Connection -->
        <div v-if="localData.sourceType === 'database'">
          <v-text-field
            v-model="localData.connectionString"
            label="Connection String"
            variant="outlined"
            density="compact"
            type="password"
            class="mb-3"
            @update:model-value="updateData"
          />

          <v-text-field
            v-model="localData.query"
            label="SQL Query"
            variant="outlined"
            density="compact"
            class="mb-3"
            @update:model-value="updateData"
          />

          <v-btn
            variant="outlined"
            size="small"
            prepend-icon="mdi-connection"
            :disabled="!localData.connectionString"
            @click="testConnection"
          >
            Test Connection
          </v-btn>
        </div>

        <!-- API Endpoint -->
        <div v-if="localData.sourceType === 'api'">
          <v-text-field
            v-model="localData.apiUrl"
            label="API Endpoint URL"
            variant="outlined"
            density="compact"
            class="mb-3"
            @update:model-value="updateData"
          />

          <v-select
            v-model="localData.httpMethod"
            :items="['GET', 'POST']"
            label="HTTP Method"
            variant="outlined"
            density="compact"
            class="mb-3"
            @update:model-value="updateData"
          />

          <v-textarea
            v-if="localData.httpMethod === 'POST'"
            v-model="localData.requestBody"
            label="Request Body (JSON)"
            variant="outlined"
            density="compact"
            rows="3"
            class="mb-3"
            @update:model-value="updateData"
          />
        </div>

        <!-- Data Preview -->
        <div v-if="previewData && previewData.length > 0" class="data-preview mt-4">
          <h5 class="text-subtitle-2 mb-2">Data Preview</h5>
          <v-table density="compact">
            <thead>
              <tr>
                <th
                  v-for="column in Object.keys(previewData[0])"
                  :id="`header-${column}`"
                  :key="column"
                  class="text-left"
                >
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in previewData.slice(0, 3)" :key="index">
                <td v-for="column in Object.keys(row)" :key="column">
                  {{ row[column] }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <p class="text-caption text-medium-emphasis mt-2">
            Showing {{ Math.min(3, previewData.length) }} of {{ previewData.length }} rows
          </p>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-eye"
          :disabled="!isConfigured"
          @click="loadPreview"
        >
          Preview Data
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-cog"
          @click="showAdvanced = !showAdvanced"
        >
          {{ showAdvanced ? 'Hide' : 'Show' }} Advanced
        </v-btn>
      </v-card-actions>

      <!-- Advanced Options -->
      <v-expand-transition>
        <v-card-text v-if="showAdvanced" class="border-t">
          <h5 class="text-subtitle-2 mb-3">Advanced Options</h5>

          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model.number="localData.sampleSize"
                label="Sample Size"
                variant="outlined"
                density="compact"
                type="number"
                min="100"
                max="10000"
                @update:model-value="updateData"
              />
            </v-col>
            <v-col cols="6">
              <v-switch
                v-model="localData.includeHeaders"
                label="Include Headers"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
          </v-row>

          <v-textarea
            v-model="localData.preprocessingScript"
            label="Preprocessing Script (Python)"
            variant="outlined"
            density="compact"
            rows="4"
            placeholder="# Optional preprocessing code"
            @update:model-value="updateData"
          />
        </v-card-text>
      </v-expand-transition>
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
  sourceType: 'file' as string,
  files: null as File[] | null,
  connectionString: '',
  query: '',
  apiUrl: '',
  httpMethod: 'GET' as 'GET' | 'POST',
  requestBody: '',
  sampleSize: 1000,
  includeHeaders: true,
  preprocessingScript: '',
  ...props.data,
});

const showAdvanced = ref(false);
const previewData = ref<any[]>([]);

// Source type options
const sourceTypes = [
  { title: 'File Upload', value: 'file' },
  { title: 'Database', value: 'database' },
  { title: 'API Endpoint', value: 'api' },
  { title: 'Cloud Storage', value: 'cloud' },
];

// Computed
const isConfigured = computed(() => {
  switch (localData.value.sourceType) {
    case 'file':
      return !!(localData.value.files && localData.value.files.length > 0);
    case 'database':
      return !!(localData.value.connectionString && localData.value.query);
    case 'api':
      return !!localData.value.apiUrl;
    default:
      return false;
  }
});

// Methods
const updateData = () => {
  emit('update', { ...localData.value });
  emit('validate', isConfigured.value);
};

const testConnection = async () => {
  // Mock connection test
  try {
    // In a real app, this would make an API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Connection test successful');
  } catch (error) {
    console.error('Connection test failed:', error);
  }
};

const loadPreview = async () => {
  if (!isConfigured.value) return;

  // Mock data preview
  previewData.value = [
    { id: 1, name: 'John Doe', age: 30, city: 'New York' },
    { id: 2, name: 'Jane Smith', age: 25, city: 'Los Angeles' },
    { id: 3, name: 'Bob Johnson', age: 35, city: 'Chicago' },
  ];
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
.data-input-step {
  width: 100%;
}

.step-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.step-card--configured {
  border-color: rgba(76, 175, 80, 0.3);
}

.data-preview {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 12px;
}

.border-t {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
</style>
