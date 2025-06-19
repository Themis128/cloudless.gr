<template>
  <div class="flow-toolbar">
    <v-card variant="outlined" class="toolbar-card">
      <v-card-title class="d-flex align-center">
        <v-icon color="primary" class="me-2"> mdi-toolbox </v-icon>
        Pipeline Components
      </v-card-title>

      <v-card-text>
        <div class="component-grid">
          <div
            v-for="component in availableComponents"
            :key="component.name"
            class="component-item"
          >
            <v-btn
              :color="component.color"
              :prepend-icon="component.icon"
              variant="outlined"
              block
              class="component-btn"
              @click="addStep(component)"
            >
              {{ component.label }}
            </v-btn>
            <p class="text-caption text-center mt-1 text-medium-emphasis">
              {{ component.description }}
            </p>
          </div>
        </div>
      </v-card-text>

      <!-- Quick Actions -->
      <v-card-actions class="px-4 pb-4">
        <v-btn
          variant="text"
          prepend-icon="mdi-magic-staff"
          color="primary"
          @click="showTemplateDialog = true"
        >
          Use Template
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          prepend-icon="mdi-broom"
          color="error"
          :disabled="steps.length === 0"
          @click="confirmClearAll = true"
        >
          Clear All
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Template Dialog -->
    <v-dialog v-model="showTemplateDialog" max-width="600">
      <v-card>
        <v-card-title>Pipeline Templates</v-card-title>
        <v-card-text>
          <v-row>
            <v-col
              v-for="template in pipelineTemplates"
              :key="template.name"
              cols="12"
              md="6"
            >
              <v-card variant="outlined" hover @click="applyTemplate(template)">
                <v-card-text class="text-center">
                  <v-icon :color="template.color" size="48" class="mb-2">
                    {{ template.icon }}
                  </v-icon>
                  <h4 class="text-h6 mb-1">{{ template.name }}</h4>
                  <p class="text-body-2 text-medium-emphasis">
                    {{ template.description }}
                  </p>
                  <div class="mt-2">
                    <v-chip
                      v-for="step in template.steps"
                      :key="step"
                      size="x-small"
                      variant="tonal"
                      class="ma-1"
                    >
                      {{ step }}
                    </v-chip>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showTemplateDialog = false"> Cancel </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Clear All Confirmation -->
    <v-dialog v-model="confirmClearAll" max-width="400">
      <v-card>
        <v-card-title class="text-h6">Clear All Steps?</v-card-title>
        <v-card-text>
          This will remove all steps from your pipeline. This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmClearAll = false"> Cancel </v-btn>
          <v-btn color="error" variant="text" @click="clearAllSteps"> Clear All </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Props
const props = defineProps<{
  steps: Array<any>;
}>();

// Emits
const emit = defineEmits<{
  'add-step': [step: any];
  'clear-all': [];
  'apply-template': [template: any];
}>();

// Reactive state
const showTemplateDialog = ref(false);
const confirmClearAll = ref(false);

// Available components to add
const availableComponents = ref([
  {
    name: 'DataInput',
    label: 'Data Input',
    description: 'Upload and configure data sources',
    icon: 'mdi-database-import',
    color: 'blue',
  },
  {
    name: 'DataValidation',
    label: 'Data Validation',
    description: 'Validate and clean your data',
    icon: 'mdi-check-circle',
    color: 'green',
  },
  {
    name: 'SmartProcessing',
    label: 'Smart Processing',
    description: 'Transform and enrich data',
    icon: 'mdi-cog',
    color: 'orange',
  },
  {
    name: 'MLAnalytics',
    label: 'ML Analytics',
    description: 'Apply machine learning models',
    icon: 'mdi-brain',
    color: 'purple',
  },
  {
    name: 'Visualization',
    label: 'Visualization',
    description: 'Create charts and graphs',
    icon: 'mdi-chart-line',
    color: 'teal',
  },
  {
    name: 'ReportGeneration',
    label: 'Report Generation',
    description: 'Generate automated reports',
    icon: 'mdi-file-document',
    color: 'indigo',
  },
]);

// Pipeline templates
const pipelineTemplates = ref([
  {
    name: 'Basic Analytics',
    description: 'Simple data processing and visualization',
    icon: 'mdi-chart-bar',
    color: 'primary',
    steps: ['Data Input', 'Validation', 'Visualization'],
    template: [
      { component: 'DataInput', data: {} },
      { component: 'DataValidation', data: {} },
      { component: 'Visualization', data: {} },
    ],
  },
  {
    name: 'ML Pipeline',
    description: 'Complete machine learning workflow',
    icon: 'mdi-robot',
    color: 'purple',
    steps: ['Data Input', 'Processing', 'ML Analytics', 'Reports'],
    template: [
      { component: 'DataInput', data: {} },
      { component: 'SmartProcessing', data: {} },
      { component: 'MLAnalytics', data: {} },
      { component: 'ReportGeneration', data: {} },
    ],
  },
  {
    name: 'Full Analytics Suite',
    description: 'Complete end-to-end analytics pipeline',
    icon: 'mdi-factory',
    color: 'success',
    steps: ['All Components'],
    template: [
      { component: 'DataInput', data: {} },
      { component: 'DataValidation', data: {} },
      { component: 'SmartProcessing', data: {} },
      { component: 'MLAnalytics', data: {} },
      { component: 'Visualization', data: {} },
      { component: 'ReportGeneration', data: {} },
    ],
  },
]);

// Methods
const addStep = (component: any) => {
  const step = {
    component: component.name,
    data: {},
  };
  emit('add-step', step);
};

const applyTemplate = (template: any) => {
  emit('apply-template', template.template);
  showTemplateDialog.value = false;
};

const clearAllSteps = () => {
  emit('clear-all');
  confirmClearAll.value = false;
};
</script>

<style scoped>
.flow-toolbar {
  margin-bottom: 24px;
}

.toolbar-card {
  border: 2px solid rgba(25, 118, 210, 0.1);
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.02) 0%, rgba(25, 118, 210, 0.05) 100%);
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.component-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.component-btn {
  height: 48px;
  font-weight: 500;
  text-transform: none;
  transition: all 0.3s ease;
}

.component-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Responsive design */
@media (max-width: 768px) {
  .component-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .component-btn {
    height: 56px;
  }
}
</style>
