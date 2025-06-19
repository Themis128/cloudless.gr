<template>
  <div class="flow-step">
    <v-card
      :class="stepClasses"
      :elevation="elevation"
      @mouseenter="hover = true"
      @mouseleave="hover = false"
    >
      <!-- Step Header -->
      <v-card-title class="step-header">
        <div class="d-flex align-center">
          <v-icon :color="stepConfig.color" class="me-2">
            {{ stepConfig.icon }}
          </v-icon>
          <div>
            <h4 class="text-h6 font-weight-medium">{{ stepConfig.title }}</h4>
            <p class="text-caption text-medium-emphasis mb-0">
              Step {{ index + 1 }} of {{ totalSteps }}
            </p>
          </div>
        </div>

        <!-- Step Status -->
        <div class="step-status">
          <v-chip
            :color="statusColor"
            :prepend-icon="statusIcon"
            size="small"
            variant="tonal"
          >
            {{ statusText }}
          </v-chip>
        </div>
      </v-card-title>

      <!-- Step Content -->
      <v-card-text class="step-content">
        <slot />
      </v-card-text>

      <!-- Step Actions -->
      <v-card-actions v-if="!previewMode" class="step-actions">
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-cog"
          @click="showSettings = true"
        >
          Configure
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-play"
          color="success"
          :disabled="!isValid"
          @click="$emit('execute')"
        >
          Test
        </v-btn>
      </v-card-actions>

      <!-- Drag Handle -->
      <div v-if="draggable && !previewMode" class="drag-handle" @mousedown="startDrag">
        <v-icon size="small">mdi-drag</v-icon>
      </div>
    </v-card>

    <!-- Settings Dialog -->
    <v-dialog v-model="showSettings" max-width="500">
      <v-card>
        <v-card-title>{{ stepConfig.title }} Settings</v-card-title>
        <v-card-text>
          <slot name="settings">
            <p class="text-body-2 text-medium-emphasis">
              No additional settings available for this step.
            </p>
          </slot>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showSettings = false"> Cancel </v-btn>
          <v-btn color="primary" variant="text" @click="saveSettings"> Save </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

// Props
const props = defineProps<{
  index: number;
  totalSteps: number;
  stepType: string;
  isValid?: boolean;
  previewMode?: boolean;
  draggable?: boolean;
  status?: 'idle' | 'running' | 'completed' | 'error';
}>();

// Emits
const emit = defineEmits<{
  execute: [];
  'settings-update': [settings: any];
  'drag-start': [event: MouseEvent];
}>();

// Reactive state
const hover = ref(false);
const showSettings = ref(false);

// Step configurations
const stepConfigs = {
  DataInput: {
    title: 'Data Input',
    icon: 'mdi-database-import',
    color: 'blue',
  },
  DataValidation: {
    title: 'Data Validation',
    icon: 'mdi-check-circle',
    color: 'green',
  },
  SmartProcessing: {
    title: 'Smart Processing',
    icon: 'mdi-cog',
    color: 'orange',
  },
  MLAnalytics: {
    title: 'ML Analytics',
    icon: 'mdi-brain',
    color: 'purple',
  },
  Visualization: {
    title: 'Visualization',
    icon: 'mdi-chart-line',
    color: 'teal',
  },
  ReportGeneration: {
    title: 'Report Generation',
    icon: 'mdi-file-document',
    color: 'indigo',
  },
};

// Computed
const stepConfig = computed(() => {
  return (
    stepConfigs[props.stepType as keyof typeof stepConfigs] || {
      title: props.stepType,
      icon: 'mdi-help-circle',
      color: 'grey',
    }
  );
});

const elevation = computed(() => {
  return hover.value ? 8 : 2;
});

const stepClasses = computed(() => {
  return [
    'step-card',
    {
      'step-card--hover': hover.value,
      'step-card--preview': props.previewMode,
      'step-card--invalid': !props.isValid,
      'step-card--running': props.status === 'running',
      'step-card--completed': props.status === 'completed',
      'step-card--error': props.status === 'error',
    },
  ];
});

const statusColor = computed(() => {
  switch (props.status) {
    case 'running':
      return 'warning';
    case 'completed':
      return 'success';
    case 'error':
      return 'error';
    default:
      return props.isValid ? 'success' : 'warning';
  }
});

const statusIcon = computed(() => {
  switch (props.status) {
    case 'running':
      return 'mdi-loading';
    case 'completed':
      return 'mdi-check';
    case 'error':
      return 'mdi-alert';
    default:
      return props.isValid ? 'mdi-check' : 'mdi-alert';
  }
});

const statusText = computed(() => {
  switch (props.status) {
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'error':
      return 'Error';
    default:
      return props.isValid ? 'Ready' : 'Needs Config';
  }
});

// Methods
const startDrag = (event: MouseEvent) => {
  emit('drag-start', event);
};

const saveSettings = () => {
  // Emit settings update
  emit('settings-update', {});
  showSettings.value = false;
};
</script>

<style scoped>
.flow-step {
  position: relative;
  width: 100%;
}

.step-card {
  position: relative;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.step-card--hover {
  transform: translateY(-4px);
}

.step-card--preview {
  pointer-events: none;
}

.step-card--invalid {
  border-color: rgba(255, 193, 7, 0.5);
}

.step-card--running {
  border-color: rgba(255, 193, 7, 0.8);
}

.step-card--completed {
  border-color: rgba(76, 175, 80, 0.8);
}

.step-card--error {
  border-color: rgba(244, 67, 54, 0.8);
}

.step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
}

.step-content {
  min-height: 120px;
}

.step-actions {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

.drag-handle {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s;
}

.drag-handle:active {
  cursor: grabbing;
}

.step-card:hover .drag-handle {
  opacity: 1;
}

.step-status {
  display: flex;
  align-items: center;
}

/* Animation for running status */
.step-card--running .v-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
