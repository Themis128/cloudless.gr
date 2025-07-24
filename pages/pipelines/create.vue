<template>
  <div>
    <LayoutPageStructure
      title="Create Pipeline"
      subtitle="Build a new AI processing pipeline"
      back-button-to="/pipelines"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <v-card class="bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-pipe</v-icon>
            Pipeline Builder
          </v-card-title>
          <v-card-text>
            <PipelinesStepperPipelineBuilder @created="handlePipelineCreated" />
          </v-card-text>
        </v-card>

        <!-- Error Alert -->
        <v-alert v-if="pipelineStore.hasError" type="error" class="mt-4">
          {{ pipelineStore.error }}
        </v-alert>

        <!-- Success Alert -->
        <v-alert v-if="pipelineStore.hasSuccess" type="success" class="mt-4">
          {{ pipelineStore.success }}
        </v-alert>
      </template>

      <template #sidebar>
        <PipelineGuide />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { usePipelineStore } from '~/stores/pipelineStore'
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'

const pipelineStore = usePipelineStore()

const handlePipelineCreated = () => {
  // Navigate to pipelines list after successful creation
  navigateTo('/pipelines')
}

onMounted(() => {
  // Reset store state when component mounts
  pipelineStore.resetBuilder()
})
</script>

<style scoped>
.create-form {
  margin-bottom: 2rem;
}

.form-field {
  margin-bottom: 1.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .v-btn {
    width: 100%;
  }
}
</style>
