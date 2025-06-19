<template>
  <div class="report-generation-step">
    <v-card class="step-card" :class="{ 'step-card--configured': isConfigured }">
      <v-card-title class="d-flex align-center">
        <v-icon color="indigo" class="me-2"> mdi-file-document </v-icon>
        <div>
          <h4 class="text-h6 font-weight-medium">Report Generation</h4>
          <p class="text-caption text-medium-emphasis mb-0">Generate automated reports</p>
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
        <!-- Report Template Selection -->
        <div class="template-selection mb-4">
          <h5 class="text-subtitle-2 mb-3">Report Template</h5>

          <v-select
            v-model="localData.template"
            :items="reportTemplates"
            label="Choose Template"
            variant="outlined"
            density="compact"
            @update:model-value="updateData"
          />
        </div>

        <!-- Report Sections -->
        <div v-if="localData.template" class="report-sections mb-4">
          <h5 class="text-subtitle-2 mb-3">Report Sections</h5>

          <v-list>
            <v-list-item v-for="section in reportSections" :key="section.id">
              <template #prepend>
                <v-checkbox
                  v-model="localData.selectedSections"
                  :value="section.id"
                  @update:model-value="updateData"
                />
              </template>

              <v-list-item-title>{{ section.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ section.description }}</v-list-item-subtitle>

              <template #append>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  @click="configureSectionDialog(section)"
                >
                  <v-icon>mdi-cog</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </div>

        <!-- Report Configuration -->
        <v-expansion-panels variant="accordion">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-cog</v-icon>
              Report Configuration
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localData.format"
                    :items="outputFormats"
                    label="Output Format"
                    variant="outlined"
                    density="compact"
                    @update:model-value="updateData"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localData.schedule"
                    :items="scheduleOptions"
                    label="Generation Schedule"
                    variant="outlined"
                    density="compact"
                    @update:model-value="updateData"
                  />
                </v-col>
              </v-row>

              <v-text-field
                v-model="localData.title"
                label="Report Title"
                variant="outlined"
                density="compact"
                @update:model-value="updateData"
              />

              <v-textarea
                v-model="localData.description"
                label="Report Description"
                variant="outlined"
                density="compact"
                rows="3"
                @update:model-value="updateData"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-email</v-icon>
              Distribution Settings
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-combobox
                v-model="localData.recipients"
                :items="[]"
                label="Email Recipients"
                variant="outlined"
                density="compact"
                multiple
                chips
                placeholder="Enter email addresses"
                @update:model-value="updateData"
              />

              <v-switch
                v-model="localData.autoSend"
                label="Automatically send when generated"
                density="compact"
                @update:model-value="updateData"
              />

              <v-switch
                v-model="localData.saveToCloud"
                label="Save to cloud storage"
                density="compact"
                @update:model-value="updateData"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <!-- Report Preview -->
        <div v-if="reportPreview" class="report-preview mt-4">
          <h5 class="text-subtitle-2 mb-3">Report Preview</h5>

          <v-card variant="outlined" class="preview-card">
            <v-card-title class="preview-title">
              {{ localData.title || 'Analytics Report' }}
            </v-card-title>

            <v-card-text class="preview-content">
              <div class="preview-section">
                <h6 class="text-subtitle-2 mb-2">Executive Summary</h6>
                <p class="text-body-2 text-medium-emphasis">
                  This report provides comprehensive insights from the analytics pipeline...
                </p>
              </div>

              <div class="preview-section">
                <h6 class="text-subtitle-2 mb-2">Key Metrics</h6>
                <v-row>
                  <v-col
                    v-for="metric in previewMetrics"
                    :key="metric.name"
                    cols="6"
                    md="3"
                  >
                    <div class="metric-preview">
                      <div class="metric-value">{{ metric.value }}</div>
                      <div class="metric-name">{{ metric.name }}</div>
                    </div>
                  </v-col>
                </v-row>
              </div>

              <div class="preview-section">
                <h6 class="text-subtitle-2 mb-2">Charts & Visualizations</h6>
                <div class="chart-placeholder">
                  <v-icon size="48" color="grey-lighten-1">mdi-chart-line</v-icon>
                  <p class="text-caption text-medium-emphasis mt-2">Chart will be embedded here</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-eye"
          :disabled="!isConfigured"
          @click="generatePreview"
        >
          Preview Report
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-play"
          :loading="generating"
          :disabled="!isConfigured"
          @click="generateReport"
        >
          Generate Report
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-download"
          :disabled="!reportGenerated"
          @click="downloadReport"
        >
          Download
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
  template: '',
  selectedSections: [] as string[],
  format: 'pdf',
  schedule: 'manual',
  title: '',
  description: '',
  recipients: [] as string[],
  autoSend: false,
  saveToCloud: true,
  ...props.data,
});

const generating = ref(false);
const reportPreview = ref(false);
const reportGenerated = ref(false);

// Configuration options
const reportTemplates = [
  { title: 'Executive Summary', value: 'executive' },
  { title: 'Technical Analysis', value: 'technical' },
  { title: 'Business Intelligence', value: 'business' },
  { title: 'Data Quality Report', value: 'quality' },
  { title: 'Custom Template', value: 'custom' },
];

const reportSections = [
  {
    id: 'summary',
    title: 'Executive Summary',
    description: 'High-level overview and key findings',
  },
  {
    id: 'metrics',
    title: 'Key Metrics',
    description: 'Important KPIs and performance indicators',
  },
  {
    id: 'charts',
    title: 'Charts & Visualizations',
    description: 'Graphs, charts, and visual representations',
  },
  {
    id: 'insights',
    title: 'Data Insights',
    description: 'AI-generated insights and patterns',
  },
  {
    id: 'recommendations',
    title: 'Recommendations',
    description: 'Actionable recommendations based on analysis',
  },
  {
    id: 'appendix',
    title: 'Technical Appendix',
    description: 'Detailed technical information and methodology',
  },
];

const outputFormats = [
  { title: 'PDF', value: 'pdf' },
  { title: 'Word Document', value: 'docx' },
  { title: 'PowerPoint', value: 'pptx' },
  { title: 'HTML', value: 'html' },
  { title: 'Excel', value: 'xlsx' },
];

const scheduleOptions = [
  { title: 'Manual', value: 'manual' },
  { title: 'Daily', value: 'daily' },
  { title: 'Weekly', value: 'weekly' },
  { title: 'Monthly', value: 'monthly' },
  { title: 'Quarterly', value: 'quarterly' },
];

// Preview data
const previewMetrics = [
  { name: 'Total Records', value: '10,523' },
  { name: 'Accuracy', value: '94.2%' },
  { name: 'Quality Score', value: '8.7/10' },
  { name: 'Processing Time', value: '2.3s' },
];

// Computed
const isConfigured = computed(() => {
  return (
    localData.value.template &&
    localData.value.selectedSections.length > 0 &&
    localData.value.format
  );
});

// Methods
const updateData = () => {
  emit('update', { ...localData.value });
  emit('validate', isConfigured.value);
};

const configureSectionDialog = (section: any) => {
  console.log('Configuring section:', section.title);
  // Implementation for section-specific configuration
};

const generatePreview = () => {
  if (isConfigured.value) {
    reportPreview.value = true;
    console.log('Generating report preview...');
  }
};

const generateReport = async () => {
  generating.value = true;

  try {
    // Simulate report generation
    await new Promise((resolve) => setTimeout(resolve, 3000));

    reportGenerated.value = true;
    console.log('Report generated successfully');
  } catch (error) {
    console.error('Report generation failed:', error);
  } finally {
    generating.value = false;
  }
};

const downloadReport = () => {
  console.log('Downloading report...');
  // Implementation for report download
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
.report-generation-step {
  width: 100%;
}

.step-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.step-card--configured {
  border-color: rgba(63, 81, 181, 0.3);
}

.report-preview {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}

.preview-card {
  max-height: 400px;
  overflow-y: auto;
}

.preview-title {
  background: rgba(63, 81, 181, 0.1);
  font-weight: 600;
}

.preview-content {
  padding: 16px;
}

.preview-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.preview-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.metric-preview {
  text-align: center;
  padding: 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.metric-value {
  font-size: 1.2rem;
  font-weight: 600;
  color: #1976d2;
}

.metric-name {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.6);
  margin-top: 4px;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 120px;
  background: rgba(0, 0, 0, 0.02);
  border: 2px dashed rgba(0, 0, 0, 0.12);
  border-radius: 8px;
}
</style>
