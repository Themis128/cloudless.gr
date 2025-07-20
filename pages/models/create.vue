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
              required
            />
            <v-select
              v-model="form.type"
              :items="modelTypes"
              label="Model Type"
              class="mb-3"
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
              required
            />
            <v-text-field
              v-model="form.framework"
              label="Framework"
              class="mb-3"
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
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

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
    const { error: err } = await supabase.from('models').insert([
      {
        name: form.value.name,
        type: form.value.type,
        description: form.value.description,
        version: form.value.version,
        framework: form.value.framework,
        created_at: new Date().toISOString(),
        status: 'draft',
      },
    ])
    
    if (err) {
      error.value = err.message
    } else {
      success.value = true
      resetForm()
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}
</script>
