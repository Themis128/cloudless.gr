<template>
  <v-container>
    <v-btn icon class="mb-4" to="/pipelines">
      <v-icon>mdi-arrow-left</v-icon>
    </v-btn>

    <h1 class="mb-4">Create Pipeline</h1>

    <v-form @submit.prevent="submit">
      <v-text-field
        v-model="form.name"
        label="Pipeline Name"
        class="mb-3"
        required
      />
      <v-textarea
        v-model="jsonString"
        label="Pipeline Config (JSON)"
        auto-grow
        rows="6"
        required
        class="mb-3"
        :error-messages="jsonError ? [jsonError] : []"
      />
      <v-btn type="submit" color="primary" :loading="loading">Create</v-btn>
    </v-form>

    <v-alert v-if="success" type="success" class="mt-4">Pipeline created!</v-alert>
    <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>

    <!-- Live Preview -->
    <v-card class="mt-6">
      <v-card-title>Parsed Pipeline Config</v-card-title>
      <v-card-text>
        <pre>{{ parsedJson }}</pre>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const jsonError = ref<string | null>(null)

const form = ref({
  name: '',
  config: {} as Record<string, unknown>,
})

const jsonString = ref(`{
  "steps": []
}`)

const projectId = ref<string | null>(null) // Set this if you have project selection

const parsedJson = computed(() => {
  try {
    const obj = JSON.parse(jsonString.value)
    jsonError.value = null
    return obj
  } catch (e) {
    jsonError.value = 'Invalid JSON'
    return {}
  }
})

async function submit() {
  error.value = null
  success.value = false
  loading.value = true

  try {
    form.value.config = JSON.parse(jsonString.value) as any
  } catch (e) {
    error.value = 'Please provide valid JSON.'
    loading.value = false
    return
  }

  // Fetch current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    error.value = 'Could not get current user.'
    loading.value = false
    return
  }

  const { error: err } = await supabase.from('pipelines').insert([
    {
      name: form.value.name,
      config: form.value.config as any,
      created_at: new Date().toISOString(),
      owner_id: user.id,
      project_id: projectId.value || '' // Ensure project_id is always a string
    }
  ])

  loading.value = false
  if (err) {
    error.value = err.message
  } else {
    success.value = true
  }
}
</script>
