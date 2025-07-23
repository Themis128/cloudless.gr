<template>
  <div>
    <v-container>
      <!-- Back to Debug Button -->
      <div class="mb-4">
        <v-btn
          color="secondary"
          variant="outlined"
          prepend-icon="mdi-arrow-left"
          @click="goBackToDebug"
        >
          Back to Debug
        </v-btn>
      </div>
      
      <h1 class="mb-4">
        Model Debug
      </h1>
      <v-form @submit.prevent="testModel">
        <v-text-field
          v-model="form.modelId"
          label="Model ID"
          class="mb-3"
          required
        />
        <v-textarea
          v-model="form.input"
          label="Input for inference"
          class="mb-3"
          rows="4"
          required
        />
        <v-select
          v-model="form.modelType"
          :items="modelTypes"
          label="Model Type"
          class="mb-3"
          required
        />
        <v-text-field
          v-model.number="form.maxTokens"
          label="Max Tokens"
          type="number"
          min="1"
          max="4096"
          class="mb-3"
          required
        />
        <v-btn type="submit" color="primary" :loading="loading">
          Test Model
        </v-btn>
        <v-btn text class="ml-2" @click="resetForm">
          Reset
        </v-btn>
        <v-btn
          color="secondary"
          text
          class="ml-2"
          @click="loadModelInfo"
        >
          Load Model Info
        </v-btn>
      </v-form>
      <v-alert v-if="success" type="success" class="mt-4">
        Model test completed successfully!
      </v-alert>
      <v-alert v-if="error" type="error" class="mt-4">
        {{ error }}
      </v-alert>
      <v-card v-if="modelInfo" class="mt-4">
        <v-card-title>Model Information</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Model ID</v-list-item-title>
              <v-list-item-subtitle>{{ modelInfo.id }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Status</v-list-item-title>
              <v-list-item-subtitle>{{ modelInfo.status }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Version</v-list-item-title>
              <v-list-item-subtitle>{{ modelInfo.version }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Last Updated</v-list-item-title>
              <v-list-item-subtitle>{{ modelInfo.lastUpdated }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
      <v-card v-if="testResults" class="mt-4">
        <v-card-title>Test Results</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Output</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.output }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Inference Time</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.inferenceTime }}ms</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Tokens Used</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.tokensUsed }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePrismaStore } from '~/stores/usePrismaStore'

const { getModel } = usePrismaStore()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const modelInfo = ref<any>(null)
const testResults = ref<any>(null)

const modelTypes = [
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'custom'
]

const form = ref({
  modelId: '',
  input: '',
  modelType: '',
  maxTokens: 100,
})

const resetForm = () => {
  form.value = {
    modelId: '',
    input: '',
    modelType: '',
    maxTokens: 100,
  }
  success.value = false
  error.value = null
  testResults.value = null
}

const testModel = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const startTime = Date.now()
    
    // Simulate model inference
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    const inferenceTime = Date.now() - startTime
    
    testResults.value = {
      output: `Echo: ${form.value.input}`,
      inferenceTime,
      tokensUsed: Math.floor(Math.random() * 50) + 10,
    }
    
    success.value = true
  } catch (err) {
    error.value = 'An unexpected error occurred during model testing'
  } finally {
    loading.value = false
  }
}

const loadModelInfo = async () => {
  if (!form.value.modelId) {
    error.value = 'Please enter a Model ID first'
    return
  }
  
  try {
    const data = await getModel(Number(form.value.modelId))
    
    if (data) {
      modelInfo.value = {
        id: data.id,
        status: data.status || 'unknown',
        version: '1.0.0', // Default version since it's not in the schema
        lastUpdated: new Date().toLocaleString(),
      }
    } else {
      error.value = 'Model not found'
    }
  } catch (err) {
    error.value = 'Failed to load model information'
  }
}

const goBackToDebug = () => {
  window.location.href = '/debug'
}
</script>
