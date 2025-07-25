<template>
  <div>
    <LayoutPageStructure
      title="Train Model"
      subtitle="Train your AI models with data"
      back-button-to="/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <v-container>
          <v-form @submit.prevent="trainModel">
            <v-text-field
              v-model="form.modelName"
              label="Model Name"
              class="mb-3"
              required
            />
            <v-text-field
              v-model="form.datasetUrl"
              label="Dataset URL"
              class="mb-3"
              required
            />
            <v-text-field
              v-model.number="form.epochs"
              label="Epochs"
              type="number"
              min="1"
              class="mb-3"
              required
            />
            <v-btn type="submit" color="primary" :loading="loading">
              Train
            </v-btn>
            <v-btn text class="ml-2" @click="resetForm">
              Reset
            </v-btn>
          </v-form>
          <v-alert v-if="success" type="success" class="mt-4">
            Training started successfully!
          </v-alert>
          <v-alert v-if="error" type="error" class="mt-4">
            {{ error }}
          </v-alert>
        </v-container>
      </template>

      <template #sidebar>
        <ModelGuide page="train" />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageStructure from '~/components/layout/LayoutPageStructure.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'

interface TrainingSession {
  id: number
  name: string
  datasetUrl: string
  epochs: number
  status: string
  createdAt: Date
  updatedAt: Date
}

const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

const form = ref({
  modelName: '',
  datasetUrl: '',
  epochs: 3,
})

const resetForm = () => {
  form.value = { modelName: '', datasetUrl: '', epochs: 3 }
  success.value = false
  error.value = null
}

const trainModel = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const trainingData = {
      name: form.value.modelName,
      datasetUrl: form.value.datasetUrl,
      epochs: form.value.epochs,
      status: 'pending'
    }
    
    const response = await $fetch<{ success: boolean; data: TrainingSession; message?: string }>('/api/prisma/training-sessions', {
      method: 'POST',
      body: trainingData
    })
    
    if (response.success) {
      success.value = true
      resetForm()
    } else {
      error.value = response.message || 'Failed to start training'
    }
  } catch (err: any) {
    console.error('Error starting training:', err)
    error.value = err.message || 'Failed to start training'
  } finally {
    loading.value = false
  }
}
</script>
