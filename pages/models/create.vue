<template>
  <v-container>
    <h1 class="mb-4">Create Model</h1>
    <v-form @submit.prevent="createModel">
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field v-model="form.name" label="Model Name" required />
          <v-select
            v-model="form.baseModel"
            :items="['gpt-3.5', 'gpt-4', 'mistral-7b']"
            label="Base Model"
            required
          />
          <v-textarea v-model="form.description" label="Description" auto-grow />
          <v-btn color="primary" type="submit" :loading="loading">Create Model</v-btn>
        </v-col>
      </v-row>
    </v-form>
    <v-alert type="success" v-if="success" class="mt-4">Model created!</v-alert>
    <v-alert type="error" v-if="error" class="mt-4">{{ error }}</v-alert>
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
  name: '',
  baseModel: '',
  description: '',
})

async function createModel() {
  loading.value = true
  error.value = null
  success.value = false

  const { error: err } = await supabase.from('models').insert({
    name: form.value.name,
    base_model: form.value.baseModel,
    description: form.value.description,
    created_at: new Date().toISOString(),
    status: 'created',
  })

  loading.value = false
  if (err) {
    error.value = err.message
  } else {
    success.value = true
    form.value = { name: '', baseModel: '', description: '' }
  }
}
</script>
