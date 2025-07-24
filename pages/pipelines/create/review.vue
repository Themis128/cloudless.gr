<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="8" class="mx-auto">
        <v-card>
          <v-card-title>Review Pipeline</v-card-title>
          <v-card-text>
            <!-- Pipeline Details -->
            <v-card class="mb-4" variant="outlined">
              <v-card-title>Pipeline Details</v-card-title>
              <v-card-text>
                <div class="d-flex mb-2">
                  <strong class="me-2">Name:</strong>
                  <span>{{ pipelineDetails?.name }}</span>
                </div>
                <div class="d-flex mb-2">
                  <strong class="me-2">Type:</strong>
                  <span>{{ pipelineDetails?.type }}</span>
                </div>
                <div class="d-flex mb-2">
                  <strong class="me-2">Description:</strong>
                  <span>{{ pipelineDetails?.description }}</span>
                </div>
                <div class="d-flex mb-2">
                  <strong class="me-2">Status:</strong>
                  <v-chip
                    :color="pipelineDetails?.isActive ? 'success' : 'error'"
                    size="small"
                  >
                    {{ pipelineDetails?.isActive ? 'Active' : 'Inactive' }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>

            <!-- Model Configuration -->
            <v-card class="mb-4" variant="outlined">
              <v-card-title>Model Configuration</v-card-title>
              <v-card-text>
                <v-alert
                  v-if="!modelConfig"
                  type="warning"
                  text="No model configuration found"
                />
                <template v-else>
                  <div class="d-flex mb-2">
                    <strong class="me-2">Model ID:</strong>
                    <span>{{ modelConfig.modelId }}</span>
                  </div>
                  <div class="mb-2">
                    <strong>Parameters:</strong>
                    <pre>{{ JSON.stringify(modelConfig.params, null, 2) }}</pre>
                  </div>
                </template>
              </v-card-text>
            </v-card>

            <!-- Pipeline Steps -->
            <v-card variant="outlined">
              <v-card-title>Pipeline Steps</v-card-title>
              <v-card-text>
                <v-alert
                  v-if="!pipelineSteps?.length"
                  type="warning"
                  text="No pipeline steps configured"
                />
                <v-timeline v-else>
                  <v-timeline-item
                    v-for="(step, index) in pipelineSteps"
                    :key="step.id"
                    :dot-color="getStepColor(step.type)"
                    size="small"
                  >
                    <template #opposite>
                      Step {{ index + 1 }}
                    </template>
                    <div class="mb-2">
                      <strong>{{ step.name }}</strong>
                    </div>
                    <div class="text-caption mb-2">
                      Type: {{ step.type }}
                    </div>
                    <v-expansion-panels>
                      <v-expansion-panel>
                        <v-expansion-panel-title>
                          Configuration
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                          <pre>{{ JSON.stringify(typeof step.config === 'string' ? JSON.parse(step.config) : step.config, null, 2) }}</pre>
                        </v-expansion-panel-text>
                      </v-expansion-panel>
                    </v-expansion-panels>
                  </v-timeline-item>
                </v-timeline>
              </v-card-text>
            </v-card>

            <!-- Navigation -->
            <v-card-actions class="mt-4">
              <v-btn
                color="secondary"
                variant="outlined"
                @click="goBack"
              >
                Back
              </v-btn>
              <v-spacer />
              <v-btn
                color="error"
                variant="outlined"
                class="me-2"
                @click="resetPipeline"
              >
                Reset
              </v-btn>
              <v-btn
                color="primary"
                :loading="loading"
                :disabled="!isValid"
                @click="createPipelineData"
              >
                Create Pipeline
              </v-btn>
            </v-card-actions>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePrismaStore } from '~/stores/usePrismaStore'
import type { ModelConfig, PipelineDetails, PipelineStep, PipelineStepType } from '~/types/Pipeline'

const router = useRouter()
const { createPipeline } = usePrismaStore()
const loading = ref(false)

const pipelineDetails = ref<PipelineDetails | null>(null)
const modelConfig = ref<ModelConfig | null>(null)
const pipelineSteps = ref<PipelineStep[] | null>(null)

const isValid = computed(() => {
  return (
    pipelineDetails.value &&
    modelConfig.value &&
    Array.isArray(pipelineSteps.value) &&
    pipelineSteps.value.length > 0
  )
})

onMounted(() => {
  // Load saved data from localStorage
  try {
    pipelineDetails.value = JSON.parse(localStorage.getItem('pipelineDetails') || 'null')
    modelConfig.value = JSON.parse(localStorage.getItem('pipelineModelConfig') || 'null')
    pipelineSteps.value = JSON.parse(localStorage.getItem('pipelineSteps') || 'null')
  } catch (error) {
    // console.error('Error loading pipeline data:', error)
  }
})

const getStepColor = (type: PipelineStepType): string => {
  const colors: Record<PipelineStepType, string> = {
    input_processor: 'primary',
    llm_processor: 'success',
    output_processor: 'info',
    data_transformer: 'warning',
    validator: 'error'
  }
  return colors[type]
}

const goBack = () => {
  router.push('/pipelines/create/config')
}

const resetPipeline = () => {
  localStorage.removeItem('pipelineDetails')
  localStorage.removeItem('pipelineModelConfig')
  localStorage.removeItem('pipelineSteps')
  router.push('/pipelines/create/details')
}

const createPipelineData = async () => {
  if (!isValid.value || !pipelineDetails.value || !modelConfig.value || !pipelineSteps.value) return
  
  loading.value = true
  try {
    // For now, we'll use a default user ID since we don't have auth context
    // In a real app, you'd get this from the auth system
    const userId = 1 // Default user ID

    const pipelineData = {
      name: pipelineDetails.value.name,
      description: pipelineDetails.value.description,
      config: {
        model: modelConfig.value,
        steps: pipelineSteps.value
      },
      status: pipelineDetails.value.isActive ? 'active' : 'draft',
      userId: userId
    }

    await pipelineStore.createPipeline(pipelineData)

    // Clear localStorage
    resetPipeline()
    
    // Navigate to pipelines list
    router.push('/pipelines')
  } catch (error) {
    // console.error('Error creating pipeline:', error)
  } finally {
    loading.value = false
  }
}
</script> 