<template>
  <PipelineGuide />

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
      <v-select
        v-model="selectedModel"
        :items="modelOptions"
        item-title="name"
        item-value="id"
        label="Select Model (optional)"
        class="mb-3"
      />
      <v-select
        v-model="selectedBot"
        :items="botOptions"
        item-title="name"
        item-value="id"
        label="Select Bot (optional)"
        class="mb-3"
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
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const jsonError = ref<string | null>(null)

const form = ref({
  name: '',
  config: {} as Record<string, unknown>,
})
const selectedModel = ref('')
const modelOptions = ref<any[]>([])
const selectedBot = ref('')
const botOptions = ref<any[]>([])

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

import { onMounted } from 'vue'
onMounted(async () => {
  // Fetch available models for picker
  const { data: models, error: modelErr } = await supabase
    .from('models')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(20)
  if (!modelErr && models) {
    modelOptions.value = models
  }
  // Fetch available bots for picker
  const { data: bots, error: botErr } = await supabase
    .from('bots')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(20)
  if (!botErr && bots) {
    botOptions.value = bots
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

  // Allow user to select either model, bot, or both
  if (!selectedModel.value && !selectedBot.value) {
    error.value = 'Please select at least a model or a bot to associate with this pipeline.'
    loading.value = false
    return
  }
  if (selectedModel.value) form.value.config.model = selectedModel.value
  if (selectedBot.value) form.value.config.bot_id = selectedBot.value

  // You need to provide owner_id, e.g. from user session or context
  const { data: userData } = await supabase.auth.getUser()
  const ownerId = userData?.user?.id || '' // Replace with your actual user id logic

  const { error: err } = await supabase.from('pipelines').insert([
    {
      name: form.value.name,
      config: form.value.config as any,
      created_at: new Date().toISOString(),
      model: selectedModel.value || null,
      bot_id: selectedBot.value || null,
      project_id: projectId.value || '', // Ensure project_id is always a string
      owner_id: ownerId
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
