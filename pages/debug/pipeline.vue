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
        Pipeline Debug
      </h1>
      <v-form @submit.prevent="testPipeline">
        <v-text-field
          v-model="form.pipelineId"
          label="Pipeline ID"
          class="mb-3"
          required
        />
        <v-textarea
          v-model="form.input"
          label="Input Data"
          class="mb-3"
          rows="4"
          required
        />
        <v-select
          v-model="form.pipelineType"
          :items="pipelineTypes"
          label="Pipeline Type"
          class="mb-3"
          required
        />
        <v-text-field
          v-model.number="form.timeout"
          label="Timeout (seconds)"
          type="number"
          min="1"
          max="300"
          class="mb-3"
          required
        />
        <v-btn type="submit" color="primary" :loading="loading">
          Test Pipeline
        </v-btn>
        <v-btn text class="ml-2" @click="resetForm">
          Reset
        </v-btn>
        <v-btn
          color="secondary"
          text
          class="ml-2"
          @click="loadPipelineInfo"
        >
          Load Pipeline Info
        </v-btn>
      </v-form>
      <v-alert v-if="success" type="success" class="mt-4">
        Pipeline test completed successfully!
      </v-alert>
      <v-alert v-if="error" type="error" class="mt-4">
        {{ error }}
      </v-alert>
      <v-card v-if="pipelineInfo" class="mt-4">
        <v-card-title>Pipeline Information</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Pipeline ID</v-list-item-title>
              <v-list-item-subtitle>{{ pipelineInfo.id }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Status</v-list-item-title>
              <v-list-item-subtitle>{{ pipelineInfo.status }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Type</v-list-item-title>
              <v-list-item-subtitle>{{ pipelineInfo.type }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Last Updated</v-list-item-title>
              <v-list-item-subtitle>{{ pipelineInfo.lastUpdated }}</v-list-item-subtitle>
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
              <v-list-item-title>Execution Time</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.executionTime }}ms</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Steps Completed</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.stepsCompleted }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Success Rate</v-list-item-title>
              <v-list-item-subtitle>{{ testResults.successRate }}%</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const pipelineInfo = ref<any>(null)
const testResults = ref<any>(null)

const pipelineTypes = [
  'Data Processing',
  'Model Training',
  'Inference',
  'Data Pipeline',
  'Custom'
]

const form = ref({
  pipelineId: '',
  input: '',
  pipelineType: '',
  timeout: 60,
})

const resetForm = () => {
  form.value = {
    pipelineId: '',
    input: '',
    pipelineType: '',
    timeout: 60,
  }
  success.value = false
  error.value = null
  testResults.value = null
}

const testPipeline = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const startTime = Date.now()
    
    // Simulate pipeline execution
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))
    
    const executionTime = Date.now() - startTime
    
    testResults.value = {
      output: `Processed: ${form.value.input}`,
      executionTime,
      stepsCompleted: Math.floor(Math.random() * 5) + 1,
      successRate: Math.floor(Math.random() * 20) + 80, // 80-100%
    }
    
    success.value = true
  } catch (err) {
    error.value = 'An unexpected error occurred during pipeline testing'
  } finally {
    loading.value = false
  }
}

const loadPipelineInfo = async () => {
  if (!form.value.pipelineId) {
    error.value = 'Please enter a Pipeline ID first'
    return
  }
  
  try {
    const { data, error: err } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', form.value.pipelineId)
      .single()
    
    if (err) {
      error.value = err.message
    } else {
      pipelineInfo.value = {
        id: data.id,
        status: data.status || 'unknown',
        type: data.type || 'unknown',
        lastUpdated: new Date().toLocaleString(),
      }
    }
  } catch (err) {
    error.value = 'Failed to load pipeline information'
  }
}

const goBackToDebug = () => {
  window.location.href = '/debug'
}
</script>
