<template>
  <div class="flow-container">
    <!-- Pipeline Header -->
    <div class="pipeline-header mb-6">
      <div class="d-flex align-center justify-space-between">
        <div class="pipeline-info">
          <h3 class="text-h5 font-weight-bold text-primary mb-1">Analytics Pipeline</h3>
          <p class="text-body-2 text-medium-emphasis">{{ steps.length }} steps configured</p>
        </div>
        <div class="pipeline-actions">
          <v-btn
            variant="outlined"
            size="small"
            prepend-icon="mdi-eye"
            @click="previewMode = !previewMode"
          >
            {{ previewMode ? 'Edit' : 'Preview' }}
          </v-btn>
          <v-btn
            variant="outlined"
            size="small"
            prepend-icon="mdi-play"
            color="success"
            :disabled="!canExecute"
            @click="executePipeline"
          >
            Execute
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Pipeline Flow -->
    <div class="pipeline-flow">
      <v-row class="pipeline-steps">
        <v-col
          v-for="(step, index) in steps"
          :key="`step-${index}`"
          cols="12"
          md="6"
          lg="4"
          class="step-column"
        >
          <!-- Step Wrapper -->
          <div class="step-wrapper">
            <!-- Step Controls -->
            <div class="step-controls">
              <v-btn
                icon
                size="x-small"
                variant="text"
                :disabled="index === 0"
                @click="moveStep(index, -1)"
              >
                <v-icon>mdi-arrow-up</v-icon>
              </v-btn>
              <v-btn
                icon
                size="x-small"
                variant="text"
                :disabled="index === steps.length - 1"
                @click="moveStep(index, 1)"
              >
                <v-icon>mdi-arrow-down</v-icon>
              </v-btn>
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="error"
                @click="removeStep(index)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>

            <!-- Dynamic Step Component -->
            <component
              :is="resolveComponent(step.component)"
              :data="step.data"
              :index="index"
              :preview-mode="previewMode"
              @update="(val: any) => updateStep(index, val)"
              @validate="(valid: boolean) => updateStepValidation(index, valid)"
            />

            <!-- Connection Arrow (if not last step) -->
            <div v-if="index < steps.length - 1" class="step-connection">
              <v-icon color="primary" size="24"> mdi-arrow-down </v-icon>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Empty State -->
      <div v-if="steps.length === 0" class="empty-state text-center py-12">
        <v-icon size="64" color="grey-lighten-1" class="mb-4"> mdi-chart-timeline-variant </v-icon>
        <h4 class="text-h6 font-weight-medium mb-2">No Pipeline Steps</h4>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Add your first step to start building your analytics pipeline
        </p>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="$emit('add-step', { component: 'DataInput', data: {} })"
        >
          Add Data Input Step
        </v-btn>
      </div>
    </div>

    <!-- Pipeline Validation -->
    <div v-if="validationErrors.length > 0" class="pipeline-validation mt-6">
      <v-alert type="warning" variant="tonal" prominent>
        <template #title> Pipeline Validation Issues </template>
        <ul>
          <li v-for="error in validationErrors" :key="error">
            {{ error }}
          </li>
        </ul>
      </v-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, defineAsyncComponent } from 'vue';

// Props
const props = defineProps<{
  steps: Array<{
    component: string;
    data: Record<string, unknown>;
  }>;
}>();

// Emits
const emit = defineEmits<{
  'update:steps': [steps: Array<{ component: string; data: Record<string, unknown> } | undefined>];
  'add-step': [step: { component: string; data: Record<string, unknown> }];
  execute: [];
}>();

// Reactive state
const previewMode = ref(false);
const stepValidations = ref<Record<number, boolean>>({});

// Computed
const canExecute = computed(() => {
  return props.steps.length > 0 && Object.values(stepValidations.value).every(Boolean);
});

const validationErrors = computed(() => {
  const errors: string[] = [];

  if (props.steps.length === 0) {
    errors.push('Pipeline must have at least one step');
  }

  props.steps.forEach((step, index) => {
    if (!stepValidations.value[index]) {
      errors.push(`Step ${index + 1} (${step.component}) has validation errors`);
    }
  });

  return errors;
});

// Methods
const resolveComponent = (name: string) => {
  return defineAsyncComponent(() => import(`~/components/builder/steps/${name}.vue`));
};

const updateStep = (index: number, newData: Record<string, unknown>) => {
  const updated = [...props.steps];
  updated[index].data = newData;
  emit('update:steps', updated);
};

const updateStepValidation = (index: number, valid: boolean) => {
  stepValidations.value[index] = valid;
};

const moveStep = (index: number, direction: number) => {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= props.steps.length) return;

  const updated = [...props.steps];
  const temp = updated[index];
  updated[index] = updated[newIndex];
  updated[newIndex] = temp;

  emit('update:steps', updated);
};

const removeStep = (index: number) => {
  const updated = [...props.steps];
  updated.splice(index, 1);
  emit('update:steps', updated);

  // Clean up validation state
  delete stepValidations.value[index];
};

const executePipeline = () => {
  if (canExecute.value) {
    emit('execute');
  }
};

// Initialize validation state
watch(
  () => props.steps,
  (newSteps) => {
    // Initialize validation for new steps
    newSteps.forEach((_, index) => {
      if (!(index in stepValidations.value)) {
        stepValidations.value[index] = false;
      }
    });
  },
  { immediate: true, deep: true },
);
</script>

<style scoped>
.flow-container {
  width: 100%;
  max-width: 100%;
}

.pipeline-header {
  background: rgba(25, 118, 210, 0.05);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(25, 118, 210, 0.1);
}

.pipeline-flow {
  position: relative;
}

.pipeline-steps {
  position: relative;
}

.step-column {
  position: relative;
}

.step-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-controls {
  position: absolute;
  top: -8px;
  right: 8px;
  z-index: 10;
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transition: opacity 0.2s;
}

.step-wrapper:hover .step-controls {
  opacity: 1;
}

.step-connection {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
  position: relative;
}

.step-connection::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 32px;
  background: linear-gradient(
    to bottom,
    rgba(25, 118, 210, 0.3),
    rgba(25, 118, 210, 0.8),
    rgba(25, 118, 210, 0.3)
  );
  z-index: -1;
}

.empty-state {
  border: 2px dashed rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  margin: 40px 0;
}

.pipeline-validation {
  margin-top: 24px;
}

/* Responsive design */
@media (max-width: 768px) {
  .step-controls {
    position: static;
    opacity: 1;
    justify-content: center;
    margin-bottom: 8px;
  }

  .step-connection::before {
    height: 24px;
  }
}
</style>
