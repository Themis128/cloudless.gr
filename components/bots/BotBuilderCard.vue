<template>
  <v-card>
    <v-snackbar v-model="showIncompleteWarning" color="warning" timeout="3000">
      Please complete the required fields for this step.
    </v-snackbar>


    <v-progress-linear :value="progressValue" color="primary" height="6" class="mb-2" />

    <v-card-text>
      <div v-if="step === 0">
        <StepBotDetails
          :form="form"
          :nameError="nameError ? [nameError] : []"
          :promptError="promptError ? [promptError] : []"
          :validateName="validateName"
          :validatePrompt="validatePrompt"
          :description="steps[0]?.description || ''"
        />
        <div class="mt-4">
          <v-btn color="primary" @click="handleNextStep">Continue</v-btn>
        </div>
      </div>
      <div v-else-if="step === 1">
        <StepModelSelect
          :form="form"
          :modelError="modelError ? [modelError] : []"
          :validateModel="validateModel"
          :description="steps[1]?.description || ''"
        />
        <div class="mt-4">
          <v-btn class="me-2" @click="prevStep">Back</v-btn>
          <v-btn color="primary" @click="handleNextStep">Continue</v-btn>
        </div>
      </div>
      <div v-else-if="step === 2">
        <StepSettings
          :form="form"
          :description="steps[2]?.description || ''"
        />
        <div class="mt-4">
          <v-btn class="me-2" @click="prevStep">Back</v-btn>
          <v-btn color="primary" @click="handleNextStep">Continue</v-btn>
        </div>
      </div>
      <div v-else-if="step === 3">
        <StepSummary :form="form" />
        <div class="mt-4">
          <v-btn class="me-2" @click="prevStep">Back</v-btn>
          <v-btn color="success" :loading="loading" @click="submitBot">Create Bot</v-btn>
        </div>
      </div>
    </v-card-text>

    <v-alert type="error" v-if="error" class="mt-2">{{ error }}</v-alert>
    <v-alert type="success" v-if="success" class="mt-2">Bot created successfully!</v-alert>
  </v-card>
</template>

<script setup lang="ts">
import StepBotDetails from '~/components/bots/steps/StepBotDetails.vue'
import StepModelSelect from '~/components/bots/steps/StepModelSelect.vue'
import StepSettings from '~/components/bots/steps/StepSettings.vue'
import StepSummary from '~/components/bots/steps/StepSummary.vue'

import { ref, computed } from 'vue'
import { useBotBuilder } from '~/composables/useBotBuilder'
import { useBotFormValidation } from '~/composables/useBotFormValidation'
import { storeToRefs } from 'pinia'
import { useBotStore } from '~/stores/botStore'

const props = defineProps<{ template?: any }>()

// Use the composable for all stepper state and logic

const {
  form, step: stepRef, steps, progressValue,
  nextStep, prevStep, goToStep, isStepComplete, submitBot
} = useBotBuilder(props.template)

const step = computed({
  get: () => Number(stepRef.value),
  set: v => { stepRef.value = Number(v) }
})

const {
  nameError, promptError, modelError,
  validateName, validatePrompt, validateModel
} = useBotFormValidation(form)

const botStore = useBotStore()
const { loading, success, error } = storeToRefs(botStore)

const showIncompleteWarning = ref(false)


function validateStep(idx: number) {
  // Always run validation before checking errors
  if (idx === 0) {
    validateName();
    validatePrompt();
    return !nameError.value && !promptError.value
  }
  if (idx === 1) {
    validateModel();
    return !modelError.value
  }
  return true
}

function handleNextStep() {
  // Debug: log step and validation
  console.log('handleNextStep called, step:', step.value)
  const valid = validateStep(step.value)
  console.log('validateStep result:', valid, 'nameError:', nameError.value, 'promptError:', promptError.value, 'modelError:', modelError.value)
  if (!valid) {
    showIncompleteWarning.value = true
    return
  }
  // Directly increment step to ensure reactivity
  step.value++
  console.log('After step.value++, step:', step.value)
}
</script>
