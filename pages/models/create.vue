<template>
  <div class="mb-4" v-if="wizard.current.value && wizard.current.value.description">
    <v-alert type="info" border="start" variant="tonal" class="mb-4">
      <div v-html="wizard.current.value.description" />
    </v-alert>
  </div>
  <ModelGuide />
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
    <v-container>
      <h1 class="mb-4">Create Model</h1>
      <v-form @submit.prevent="onSubmit" ref="formRef" aria-label="Model creation form">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.name"
              label="Model Name"
              placeholder="e.g. MyModel"
              required
              class="mb-3"
              :error-messages="nameError ? [nameError] : []"
              autofocus
              aria-required="true"
              aria-describedby="name-desc"
            />
            <div id="name-desc" class="text-caption mb-2">Model name must be unique and descriptive.</div>
            <v-row class="mt-4">
              <v-col cols="6">
                <v-btn color="secondary" variant="outlined" :disabled="wizard.isFirstStep.value" @click="wizard.prev">
                  <v-icon start>mdi-arrow-left</v-icon> Back
                </v-btn>
              </v-col>
              <v-col cols="6" class="text-right">
                <v-btn color="primary" variant="elevated" :disabled="!canProceed" @click="wizard.isLastStep.value ? onSubmit() : wizard.next">
                  <span v-if="!wizard.isLastStep.value">Next <v-icon end>mdi-arrow-right</v-icon></span>
                  <span v-else>Submit <v-icon end>mdi-check</v-icon></span>
                </v-btn>
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </v-form>
      <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="4000">{{ snackbarMsg }}</v-snackbar>
      <v-dialog v-model="showHelp" max-width="400">
        <v-card>
          <v-card-title>Help</v-card-title>
          <v-card-text>
            Enter a unique model name. Use the navigation buttons to move between steps. For more info, see the documentation.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" @click="showHelp = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-alert type="success" v-if="success" class="mt-4" aria-live="polite">Model created!</v-alert>
      <div v-if="success" class="mt-4">
        <v-card color="primary" variant="tonal" class="pa-4">
          <h3 class="mb-2">Next Steps</h3>
          <ul>
            <li>
              <strong>View your models:</strong> <v-btn to="/models" color="primary" variant="text" size="small">Go to Models List</v-btn>
            </li>
            <li>
              <strong>Train your model:</strong> <v-btn to="/models/train" color="primary" variant="text" size="small">Train Model</v-btn>
            </li>
            <li>
              <strong>Deploy your model:</strong> <v-btn to="/models/deploy" color="primary" variant="text" size="small">Deploy Model</v-btn>
            </li>
          </ul>
        </v-card>
      </div>
      <v-alert type="error" v-if="error" class="mt-4" aria-live="assertive">{{ error }}</v-alert>
    </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useWizard } from '~/composables/useWizard'
import { useSupabase } from '~/composables/supabase'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'

const supabase = useSupabase()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)

const form = ref({
  name: '',
})

// Wizard stepper integration
const wizard = useWizard()

// Onboarding/help
const showOnboarding = ref(true)
const showHelp = ref(false)

// Inline validation
const nameError = ref('')
const showSnackbar = ref(false)
const snackbarMsg = ref('')
const snackbarColor = ref('success')

const canProceed = computed(() => {
  return form.value.name && !nameError.value
})

watch(() => form.value.name, (val) => {
  if (!val) nameError.value = 'Model name is required.'
  else if (val.length < 3) nameError.value = 'Name must be at least 3 characters.'
  else nameError.value = ''
})

async function onSubmit() {
  if (!canProceed.value) {
    showSnackbar.value = true
    snackbarMsg.value = 'Please fix errors before continuing.'
    snackbarColor.value = 'error'
    return
  }
  loading.value = true
  error.value = null
  success.value = false
  const modelInsert: any = {
    name: form.value.name,
    created_at: new Date().toISOString(),
  }
  const { error: err } = await supabase.from('models').insert(modelInsert)
  loading.value = false
  if (err) {
    error.value = err.message
  } else {
    success.value = true
    form.value = { name: '' }
    showSnackbar.value = true
    snackbarMsg.value = 'Model submitted!'
    snackbarColor.value = 'success'
  }
}
</script>
