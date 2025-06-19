<template>
  <div class="visualization-step">
    <v-card class="step-card" :class="{ 'step-card--configured': isConfigured }">
      <v-card-title class="d-flex align-center">
        <v-icon color="teal" class="me-2"> mdi-chart-line </v-icon>
        <div>
          <h4 class="text-h6 font-weight-medium">Visualization</h4>
          <p class="text-caption text-medium-emphasis mb-0">Create charts and graphs</p>
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
        <!-- Chart Type Selection -->
        <div class="chart-selection mb-4">
          <h5 class="text-subtitle-2 mb-3">Chart Configuration</h5>

          <v-select
            v-model="localData.chartType"
            :items="chartTypes"
            label="Chart Type"
            variant="outlined"
            density="compact"
            @update:model-value="updateData"
          />
        </div>

        <!-- Chart Options -->
        <div v-if="localData.chartType" class="chart-options mb-4">
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="localData.xAxis"
                :items="availableColumns"
                label="X-Axis"
                variant="outlined"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="localData.yAxis"
                :items="availableColumns"
                label="Y-Axis"
                variant="outlined"
                density="compact"
                multiple
                @update:model-value="updateData"
              />
            </v-col>
          </v-row>

          <v-row v-if="showGrouping">
            <v-col cols="12" md="6">
              <v-select
                v-model="localData.groupBy"
                :items="availableColumns"
                label="Group By"
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="updateData"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="localData.aggregation"
                :items="aggregationMethods"
                label="Aggregation"
                variant="outlined"
                density="compact"
                @update:model-value="updateData"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Chart Preview -->
        <div v-if="chartPreview" class="chart-preview mb-4">
          <h5 class="text-subtitle-2 mb-3">Chart Preview</h5>
          <div class="preview-container">
            <svg
              width="100%"
              height="200"
              viewBox="0 0 400 200"
              class="chart-svg"
            >
              <!-- Line Chart -->
              <template v-if="localData.chartType === 'line'">
                <polyline
                  :points="generateLinePoints()"
                  fill="none"
                  stroke="#1976d2"
                  stroke-width="2"
                />
                <circle
                  v-for="(point, index) in samplePoints"
                  :key="index"
                  :cx="point.x"
                  :cy="point.y"
                  r="3"
                  fill="#1976d2"
                />
              </template>

              <!-- Bar Chart -->
              <template v-if="localData.chartType === 'bar'">
                <rect
                  v-for="(bar, index) in sampleBars"
                  :key="index"
                  :x="bar.x"
                  :y="bar.y"
                  :width="bar.width"
                  :height="bar.height"
                  fill="#4caf50"
                  opacity="0.8"
                />
              </template>

              <!-- Scatter Plot -->
              <template v-if="localData.chartType === 'scatter'">
                <circle
                  v-for="(point, index) in scatterPoints"
                  :key="index"
                  :cx="point.x"
                  :cy="point.y"
                  r="4"
                  fill="#ff9800"
                  opacity="0.7"
                />
              </template>
            </svg>
          </div>
        </div>

        <!-- Styling Options -->
        <v-expansion-panels variant="accordion">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-palette</v-icon>
              Styling Options
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localData.colorScheme"
                    :items="colorSchemes"
                    label="Color Scheme"
                    variant="outlined"
                    density="compact"
                    @update:model-value="updateData"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localData.theme"
                    :items="chartThemes"
                    label="Theme"
                    variant="outlined"
                    density="compact"
                    @update:model-value="updateData"
                  />
                </v-col>
              </v-row>

              <v-text-field
                v-model="localData.title"
                label="Chart Title"
                variant="outlined"
                density="compact"
                @update:model-value="updateData"
              />

              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="localData.xAxisLabel"
                    label="X-Axis Label"
                    variant="outlined"
                    density="compact"
                    @update:model-value="updateData"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="localData.yAxisLabel"
                    label="Y-Axis Label"
                    variant="outlined"
                    density="compact"
                    @update:model-value="updateData"
                  />
                </v-col>
              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>

      <v-card-actions>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-refresh"
          :disabled="!isConfigured"
          @click="refreshPreview"
        >
          Refresh Preview
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-fullscreen"
          :disabled="!chartPreview"
          @click="showFullscreen"
        >
          Fullscreen
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-download"
          :disabled="!chartPreview"
          @click="exportChart"
        >
          Export
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
  chartType: '',
  xAxis: '',
  yAxis: [] as string[],
  groupBy: '',
  aggregation: 'sum',
  colorScheme: 'default',
  theme: 'light',
  title: '',
  xAxisLabel: '',
  yAxisLabel: '',
  ...props.data,
});

const chartPreview = ref(false);

// Configuration options
const chartTypes = [
  { title: 'Line Chart', value: 'line' },
  { title: 'Bar Chart', value: 'bar' },
  { title: 'Scatter Plot', value: 'scatter' },
  { title: 'Pie Chart', value: 'pie' },
  { title: 'Histogram', value: 'histogram' },
  { title: 'Box Plot', value: 'boxplot' },
];

const availableColumns = [
  { title: 'Date', value: 'date' },
  { title: 'Sales', value: 'sales' },
  { title: 'Revenue', value: 'revenue' },
  { title: 'Category', value: 'category' },
  { title: 'Region', value: 'region' },
];

const aggregationMethods = [
  { title: 'Sum', value: 'sum' },
  { title: 'Average', value: 'avg' },
  { title: 'Count', value: 'count' },
  { title: 'Min', value: 'min' },
  { title: 'Max', value: 'max' },
];

const colorSchemes = [
  { title: 'Default', value: 'default' },
  { title: 'Viridis', value: 'viridis' },
  { title: 'Plasma', value: 'plasma' },
  { title: 'Blues', value: 'blues' },
  { title: 'Reds', value: 'reds' },
];

const chartThemes = [
  { title: 'Light', value: 'light' },
  { title: 'Dark', value: 'dark' },
  { title: 'Minimal', value: 'minimal' },
];

// Sample data for preview
const samplePoints = ref([
  { x: 50, y: 150 },
  { x: 100, y: 120 },
  { x: 150, y: 80 },
  { x: 200, y: 100 },
  { x: 250, y: 60 },
  { x: 300, y: 90 },
  { x: 350, y: 40 },
]);

const sampleBars = ref([
  { x: 50, y: 120, width: 30, height: 80 },
  { x: 100, y: 80, width: 30, height: 120 },
  { x: 150, y: 140, width: 30, height: 60 },
  { x: 200, y: 100, width: 30, height: 100 },
  { x: 250, y: 160, width: 30, height: 40 },
]);

const scatterPoints = ref([
  { x: 80, y: 120 },
  { x: 120, y: 80 },
  { x: 160, y: 140 },
  { x: 200, y: 100 },
  { x: 240, y: 160 },
  { x: 280, y: 60 },
  { x: 320, y: 180 },
]);

// Computed
const isConfigured = computed(() => {
  return localData.value.chartType && localData.value.xAxis && localData.value.yAxis.length > 0;
});

const showGrouping = computed(() => {
  return ['bar', 'line'].includes(localData.value.chartType);
});

// Methods
const updateData = () => {
  emit('update', { ...localData.value });
  emit('validate', isConfigured.value);

  if (isConfigured.value) {
    chartPreview.value = true;
  }
};

const generateLinePoints = () => {
  return samplePoints.value.map((p) => `${p.x},${p.y}`).join(' ');
};

const refreshPreview = () => {
  if (isConfigured.value) {
    chartPreview.value = true;
    console.log('Refreshing chart preview...');
  }
};

const showFullscreen = () => {
  console.log('Showing fullscreen chart...');
};

const exportChart = () => {
  console.log('Exporting chart...');
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
.visualization-step {
  width: 100%;
}

.step-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.step-card--configured {
  border-color: rgba(0, 150, 136, 0.3);
}

.chart-preview {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}

.preview-container {
  background: white;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.chart-svg {
  display: block;
}
</style>
