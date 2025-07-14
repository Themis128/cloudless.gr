<template>
  <v-container>
    <h1 class="mb-4">Train Model</h1>
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
      <v-btn type="submit" color="primary" :loading="loading">Train</v-btn>
      <v-btn text class="ml-2" @click="resetForm">Reset</v-btn>
    </v-form>
    <v-alert v-if="success" type="success" class="mt-4">Training started successfully!</v-alert>
    <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

const form = ref({
  modelName: '',
  datasetUrl: '',
  epochs: 3
})

function resetForm() {
  form.value = { modelName: '', datasetUrl: '', epochs: 3 }
  success.value = false
  error.value = null
}

async function trainModel() {
  error.value = null
  success.value = false
  loading.value = true
  // Example: Insert a training job into a table
  const { error: err } = await supabase.from('training_sessions').insert([
    {
      name: form.value.modelName,
      dataset_url: form.value.datasetUrl,
      epochs: form.value.epochs,
      created_at: new Date().toISOString(),
      status: 'pending'
    }
  ])
  loading.value = false
  if (err) {
    error.value = err.message
  } else {
    success.value = true
    resetForm()
  }
}
</script>
