<template>
  <div>
    <PipelineGuide />
    <v-container>
      <h1 class="mb-4">
        <v-icon size="32" class="mr-3">
          mdi-pipe
        </v-icon>
        Create Pipeline
      </h1>
      
      <v-card>
        <v-card-title class="text-h6">
          Pipeline Details
        </v-card-title>
        <v-card-text>
          <v-form class="create-form" @submit.prevent="createPipeline">
            <v-text-field
              v-model="form.name"
              label="Pipeline Name"
              class="form-field"
              :rules="[rules.required, rules.minLength(3)]"
              required
            />
            <v-textarea
              v-model="form.description"
              label="Description"
              class="form-field"
              rows="3"
            />
            <v-select
              v-model="form.type"
              :items="pipelineTypes"
              label="Pipeline Type"
              class="form-field"
              :rules="[rules.required]"
              required
            />
            <v-text-field
              v-model="form.version"
              label="Version"
              class="form-field"
              :rules="[rules.required]"
              required
            />
            <v-select
              v-model="form.inputType"
              :items="inputTypes"
              label="Input Type"
              class="form-field"
              :rules="[rules.required]"
              required
            />
            <v-select
              v-model="form.outputType"
              :items="outputTypes"
              label="Output Type"
              class="form-field"
              :rules="[rules.required]"
              required
            />
            
            <div class="form-actions">
              <v-btn
                type="submit"
                color="primary"
                :loading="loading"
                size="large"
              >
                <v-icon start>
                  mdi-plus
                </v-icon>
                Create Pipeline
              </v-btn>
              <v-btn
                text
                class="ml-2"
                size="large"
                @click="resetForm"
              >
                <v-icon start>
                  mdi-refresh
                </v-icon>
                Reset
              </v-btn>
            </div>
          </v-form>
          
          <v-alert v-if="success" type="success" class="mt-4">
            <v-icon start>
              mdi-check-circle
            </v-icon>
            Pipeline created successfully!
          </v-alert>
          <v-alert v-if="error" type="error" class="mt-4">
            <v-icon start>
              mdi-alert-circle
            </v-icon>
            {{ error }}
          </v-alert>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'

interface Pipeline {
  name: string
  description?: string
  config: string
  status: string
}

const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

// Form validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
  minLength: (min: number) => (v: string) => v.length >= min || `Minimum ${min} characters required`,
  maxLength: (max: number) => (v: string) => v.length <= max || `Maximum ${max} characters allowed`,
}

const pipelineTypes = [
  'Data Processing',
  'Model Training',
  'Inference',
  'Data Pipeline',
  'Custom'
]

const inputTypes = [
  'text',
  'image',
  'audio',
  'video',
  'json',
  'csv',
  'xml'
]

const outputTypes = [
  'text',
  'image',
  'audio',
  'video',
  'json',
  'csv',
  'xml'
]

const form = ref({
  name: '',
  description: '',
  type: '',
  version: '1.0.0',
  inputType: '',
  outputType: '',
})

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    type: '',
    version: '1.0.0',
    inputType: '',
    outputType: '',
  }
  success.value = false
  error.value = null
}

const createPipeline = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const pipelineData = {
      name: form.value.name,
      description: form.value.description,
      config: JSON.stringify({
        type: form.value.type,
        version: form.value.version,
        inputType: form.value.inputType,
        outputType: form.value.outputType,
        steps: []
      }),
      status: 'draft'
    }
    
    const response = await $fetch<{ success: boolean; data: Pipeline; message?: string }>('/api/prisma/pipelines', {
      method: 'POST',
      body: pipelineData
    })
    
    if (response.success) {
      success.value = true
      // Don't reset form immediately to show success message
      // Reset form after a delay to allow user to see success message
      setTimeout(() => {
        resetForm()
      }, 3000)
    } else {
      error.value = response.message || 'Failed to create pipeline'
    }
  } catch (err: any) {
    console.error('Error creating pipeline:', err)
    error.value = err.message || 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}
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
