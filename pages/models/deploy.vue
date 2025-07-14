<template>
  <div class="deploy-model-page">
    <h1>Deploy Model</h1>
    <v-alert type="info" class="mb-4">
      Select a model to deploy. Deployment will make your model available as an API endpoint.
    </v-alert>
    <v-select
      v-model="selectedModel"
      :items="models"
      item-title="name"
      item-value="id"
      label="Select Model"
      :loading="loading"
      :disabled="loading"
      return-object
      class="mb-4"
    />
    <v-btn color="primary" :disabled="!selectedModel || deploying" @click="deployModel">
      <v-icon start>mdi-rocket-launch</v-icon>
      Deploy
    </v-btn>
    <v-alert v-if="deployStatus" :type="deployStatus.type" class="mt-4">
      {{ deployStatus.message }}
      <div v-if="deployStatus.endpoint">
        <strong>Endpoint:</strong> <code>{{ deployStatus.endpoint }}</code>
      </div>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useModelStore } from '~/stores/modelStore'
import { storeToRefs } from 'pinia'
import type { Model } from '~/types/Model'

const modelStore = useModelStore()
const { models: modelNames } = storeToRefs(modelStore)
const models = computed<Model[]>(() => {
  // If your store has only names, fake ids for demo; replace with real Model[] in production
  return modelNames.value.map((name, idx) => ({ id: String(idx + 1), name }))
})
const loading = ref(false)
const deploying = ref(false)
const selectedModel = ref<Model | null>(null)
const deployStatus = ref<{ type: 'success' | 'error' | 'info' | 'warning'; message: string; endpoint?: string } | null>(null)

async function deployModel() {
  if (!selectedModel.value) return
  deploying.value = true
  deployStatus.value = null
  try {
    // Example: call your deploy API endpoint
    const res = await $fetch<{ endpoint?: string }>('/api/models/deploy', {
      method: 'POST',
      body: { modelId: selectedModel.value.id }
    })
    deployStatus.value = {
      type: 'success',
      message: 'Model deployed successfully!',
      endpoint: res.endpoint || 'N/A'
    }
  } catch (e: any) {
    deployStatus.value = {
      type: 'error',
      message: e?.data?.message || e.message || 'Deployment failed.'
    }
  } finally {
    deploying.value = false
  }
}
</script>

<style scoped>
.deploy-model-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
</style>
