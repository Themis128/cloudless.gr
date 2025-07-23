<template>
  <div>
    <PageStructure
      title="Create Model"
      subtitle="Create a new AI model for your project"
      back-button-to="/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <v-container>
          <v-form @submit.prevent="createModel">
            <v-text-field
              v-model="form.name"
              label="Model Name"
              class="mb-3"
              :rules="[rules.required, rules.minLength(3)]"
              required
            />
            <v-select
              v-model="form.type"
              :items="modelTypes"
              label="Model Type"
              class="mb-3"
              :rules="[rules.required]"
              required
            />
            <v-textarea
              v-model="form.description"
              label="Description"
              class="mb-3"
              rows="3"
            />
            <v-text-field
              v-model="form.version"
              label="Version"
              class="mb-3"
              :rules="[rules.required]"
              required
            />
            <v-text-field
              v-model="form.framework"
              label="Framework"
              class="mb-3"
              :rules="[rules.required]"
              required
            />
            <v-btn type="submit" color="primary" :loading="loading">
              Create Model
            </v-btn>
            <v-btn text class="ml-2" @click="resetForm">
              Reset
            </v-btn>
          </v-form>
          <v-alert v-if="success" type="success" class="mt-4">
            Model created successfully!
          </v-alert>
          <v-alert v-if="error" type="error" class="mt-4">
            {{ error }}
          </v-alert>
        </v-container>
      </template>

      <template #sidebar>
        <ModelGuide page="create" />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'

interface Model {
  name: string
  type: string
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

const modelTypes = [
  'Classification',
  'Regression',
  'Neural Network',
  'Transformer',
  'Custom',
]

const form = ref({
  name: '',
  type: '',
  description: '',
  version: '1.0.0',
  framework: '',
})

const resetForm = () => {
  form.value = {
    name: '',
    type: '',
    description: '',
    version: '1.0.0',
    framework: '',
  }
  success.value = false
  error.value = null
}

const createModel = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const modelData = {
      name: form.value.name,
      type: form.value.type.toLowerCase().replace(/\s+/g, '-'),
      description: form.value.description,
      config: JSON.stringify({
        version: form.value.version,
        framework: form.value.framework,
        architecture: form.value.type
      }),
      status: 'draft'
    }
    
    const response = await $fetch<{ success: boolean; data: Model; message?: string }>('/api/prisma/models', {
      method: 'POST',
      body: modelData
    })
    
    if (response.success) {
      success.value = true
      // Don't reset form immediately to show success message
      // Reset form after a delay to allow user to see success message
      setTimeout(() => {
        resetForm()
      }, 3000)
    } else {
      error.value = response.message || 'Failed to create model'
    }
  } catch (err: any) {
    console.error('Error creating model:', err)
    error.value = err.message || 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}
</script>
