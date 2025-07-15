<template>
  <div class="mb-4" v-if="wizard.current.value && wizard.current.value.description">
    <v-alert type="info" border="start" variant="tonal" class="mb-4">
      <div v-html="wizard.current.value.description" />
    </v-alert>
  </div>

  <PipelineGuide />

  <VStepper v-model="wizard.currentStep.value" class="mb-6" alt-labels aria-label="Wizard steps">
    <VStepperHeader>
      <VStepperItem
        v-for="(step, idx) in wizard.steps"
        :key="step.title + idx"
        :complete="wizard.currentStep.value > idx"
        :value="idx"
        :aria-current="wizard.currentStep.value === idx ? 'step' : undefined"
        :tabindex="wizard.currentStep.value === idx ? 0 : -1"
        @click="wizard.goTo(idx)"
        :color="wizard.currentStep.value === idx ? 'primary' : (wizard.currentStep.value > idx ? 'success' : 'grey')"
        class="stepper-item"
      >
        <template #icon>
          <v-avatar :color="wizard.currentStep.value === idx ? 'primary' : (wizard.currentStep.value > idx ? 'success' : 'grey')" size="24">
            <span class="white--text">{{ idx + 1 }}</span>
          </v-avatar>
        </template>
        <span>{{ step.title }}</span>
        <v-tooltip activator="parent" location="top">
          {{ step.subtitle }}
        </v-tooltip>
        <div class="text-caption text-secondary">{{ step.subtitle }}</div>
      </VStepperItem>
    </VStepperHeader>
  </VStepper>
    <VStepperActions class="mt-2">
      <v-btn color="secondary" variant="outlined" :disabled="wizard.currentStep.value === 0" @click="wizard.prev">
        <v-icon start>mdi-arrow-left</v-icon> Back
      </v-btn>
      <v-btn color="primary" variant="elevated" :disabled="!canProceed" @click="wizard.isLastStep ? submit() : wizard.next">
        <span v-if="!wizard.isLastStep">Next <v-icon end>mdi-arrow-right</v-icon></span>
        <span v-else>Submit <v-icon end>mdi-check</v-icon></span>
      </v-btn>
    </VStepperActions>
  <VForm @submit.prevent="submit">
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
    <!-- The submit button is now in the stepper actions -->
  </VForm>

    <v-alert v-if="success" type="success" class="mt-4">Pipeline created!</v-alert>
    <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>

    <!-- Live Preview -->
    <v-card class="mt-6">
      <v-card-title>Parsed Pipeline Config</v-card-title>
      <v-card-text>
        <pre>{{ parsedJson }}</pre>
      </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
const canProceed = computed(() => {
  return form.value.name && !jsonError.value
})
import { ref, computed } from 'vue'
import { useWizard } from '~/composables/useWizard'
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

// Wizard stepper integration
const wizard = useWizard()

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

  // Ensure bot_id is null if not selected or empty string
  const botId = selectedBot.value && selectedBot.value !== '' ? selectedBot.value : null;
  console.log('DEBUG bot_id:', botId, 'selectedBot:', selectedBot.value);
  const pipelineInsert: any = {
    name: form.value.name,
    config: form.value.config as any,
    created_at: new Date().toISOString(),
    model: selectedModel.value || null,
    bot_id: botId,
    owner_id: ownerId
  }
  if (typeof projectId.value === 'string' && projectId.value.trim().length > 0) {
    pipelineInsert.project_id = projectId.value
  }
  const { error: err } = await supabase.from('pipelines').insert([pipelineInsert])

  loading.value = false
  if (err) {
    error.value = err.message
  } else {
    success.value = true
  }
}
</script>
