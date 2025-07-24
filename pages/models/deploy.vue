<template>
  <div>
    <LayoutPageStructure
      title="Deploy Model"
      subtitle="Deploy your models to production"
      back-button-to="/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <v-container>
          <v-form @submit.prevent="deployModel">
            <v-select
              v-model="form.selectedModel"
              :items="models"
              item-title="name"
              item-value="id"
              label="Select Model"
              class="mb-3"
              :loading="loading"
              :disabled="loading"
              return-object
              required
            />
            <v-text-field
              v-model="form.deploymentName"
              label="Deployment Name"
              class="mb-3"
              required
            />
            <v-select
              v-model="form.environment"
              :items="environments"
              label="Environment"
              class="mb-3"
              required
            />
            <v-text-field
              v-model="form.instanceType"
              label="Instance Type"
              class="mb-3"
              required
            />
            <v-text-field
              v-model.number="form.replicas"
              label="Number of Replicas"
              type="number"
              min="1"
              max="10"
              class="mb-3"
              required
            />
            <v-btn
              type="submit"
              color="primary"
              :loading="deploying"
              :disabled="!form.selectedModel"
            >
              Deploy Model
            </v-btn>
            <v-btn text class="ml-2" @click="resetForm">
              Reset
            </v-btn>
          </v-form>
          <v-alert v-if="success" type="success" class="mt-4">
            Model deployed successfully!
            <div v-if="deploymentEndpoint">
              <strong>Endpoint:</strong> <code>{{ deploymentEndpoint }}</code>
            </div>
          </v-alert>
          <v-alert v-if="error" type="error" class="mt-4">
            {{ error }}
          </v-alert>
        </v-container>
      </template>

      <template #sidebar>
        <ModelGuide page="deploy" />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'

interface Model {
  id: number
  name: string
  type: string
  status: string
  config: string
}

interface Deployment {
  id: number
  modelId: number
  name: string
  environment: string
  instanceType: string
  replicas: number
  status: string
  endpoint?: string
  createdAt: Date
  updatedAt: Date
}

const loading = ref(false)
const deploying = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const deploymentEndpoint = ref<string | null>(null)

const environments = ['development', 'staging', 'production']
const models = ref<Model[]>([])

const form = ref({
  selectedModel: null as Model | null,
  deploymentName: '',
  environment: 'development',
  instanceType: 't3.medium',
  replicas: 1,
})

const resetForm = () => {
  form.value = {
    selectedModel: null,
    deploymentName: '',
    environment: 'development',
    instanceType: 't3.medium',
    replicas: 1,
  }
  success.value = false
  error.value = null
  deploymentEndpoint.value = null
}

const loadModels = async () => {
  loading.value = true
  try {
    const response = await $fetch<{ success: boolean; data: Model[]; message?: string }>('/api/prisma/models?status=ready')
    
    if (response.success) {
      models.value = response.data || []
    } else {
      error.value = response.message || 'Failed to load models'
    }
  } catch (err: any) {
    console.error('Error loading models:', err)
    error.value = err.message || 'Failed to load models'
  } finally {
    loading.value = false
  }
}

const deployModel = async () => {
  if (!form.value.selectedModel) return
  
  error.value = null
  success.value = false
  deploying.value = true
  
  try {
    const deploymentData = {
      modelId: form.value.selectedModel.id,
      name: form.value.deploymentName,
      environment: form.value.environment,
      instanceType: form.value.instanceType,
      replicas: form.value.replicas,
      status: 'deploying'
    }
    
    const response = await $fetch<{ success: boolean; data: Deployment; message?: string }>('/api/prisma/deployments', {
      method: 'POST',
      body: deploymentData
    })
    
    if (response.success) {
      success.value = true
      deploymentEndpoint.value = `https://api.cloudless.gr/models/${form.value.selectedModel.id}`
      resetForm()
    } else {
      error.value = response.message || 'Failed to deploy model'
    }
  } catch (err: any) {
    console.error('Error deploying model:', err)
    error.value = err.message || 'An unexpected error occurred'
  } finally {
    deploying.value = false
  }
}

onMounted(() => {
  loadModels()
})
</script>

<style scoped>
.deploy-model-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
</style>
