<template>
  <v-card>
    <v-snackbar v-model="showIncompleteWarning" color="warning" timeout="3000">
      Please complete the required fields for this step.
    </v-snackbar>

    <v-progress-linear
      :value="progressValue"
      color="primary"
      height="6"
      class="mb-2"
    />

    <v-card-text>
      <div v-if="step === 0">
        <StepBotDetails
          :form="form"
          :name-error="nameError ? [nameError] : []"
          :prompt-error="promptError ? [promptError] : []"
          :validate-name="validateName"
          :validate-prompt="validatePrompt"
          :description="steps[0]?.description || ''"
        />
        <div class="mt-4">
          <v-btn color="primary" @click="handleNextStep">
            Continue
          </v-btn>
        </div>
      </div>
      <div v-else-if="step === 1">
        <StepModelSelect
          :form="form"
          :model-error="modelError ? [modelError] : []"
          :validate-model="validateModel"
          :description="steps[1]?.description || ''"
        />
        <div class="mt-4">
          <v-btn class="me-2" @click="prevStep">
            Back
          </v-btn>
          <v-btn color="primary" @click="handleNextStep">
            Continue
          </v-btn>
        </div>
      </div>
      <div v-else-if="step === 2">
        <StepSettings :form="form" :description="steps[2]?.description || ''" />
        <div class="mt-4">
          <v-btn class="me-2" @click="prevStep">
            Back
          </v-btn>
          <v-btn color="primary" @click="handleNextStep">
            Continue
          </v-btn>
        </div>
      </div>
      <div v-else-if="step === 3">
        <StepSummary :form="form" />
        <div class="mt-4">
          <v-btn class="me-2" @click="prevStep">
            Back
          </v-btn>
          <v-btn color="success" :loading="loading" @click="handleSubmit">
            Create Bot
          </v-btn>
        </div>
      </div>
    </v-card-text>

    <v-alert v-if="error" type="error" class="mt-2">
      {{ error }}
    </v-alert>
    <v-alert v-if="success" type="success" class="mt-2">
      Bot created successfully!
    </v-alert>
  </v-card>
</template>

<script setup lang="ts">
import StepBotDetails from '~/components/bots/steps/StepBotDetails.vue'
import StepModelSelect from '~/components/bots/steps/StepModelSelect.vue'
import StepSettings from '~/components/bots/steps/StepSettings.vue'
import StepSummary from '~/components/bots/steps/StepSummary.vue'

import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useBotBuilder } from '~/composables/useBotBuilder'
import { useBotFormValidation } from '~/composables/useBotFormValidation'
import { useBotStore } from '~/stores/botStore'

const props = defineProps<{ template?: any }>()
const emit = defineEmits(['created'])
// Use the composable for all stepper state and logic

const {
  form,
  step: stepRef,
  steps,
  progressValue,
  nextStep,
  prevStep,
  submitBot,
} = useBotBuilder(props.template)

const step = computed({
  get: () => Number(stepRef.value),
  set: v => {
    stepRef.value = Number(v)
  },
})

const {
  nameError,
  promptError,
  modelError,
  validateName,
  validatePrompt,
  validateModel,
} = useBotFormValidation(form)

const botStore = useBotStore()
const { loading, success, error } = storeToRefs(botStore)

const showIncompleteWarning = ref(false)

const validateStep = (idx: number) => {
  // Always run validation before checking errors
  if (idx === 0) {
    validateName()
    validatePrompt()
    return !nameError.value && !promptError.value
  }
  if (idx === 1) {
    validateModel()
    return !modelError.value
  }
  return true
}

const handleNextStep = () => {
  const valid = validateStep(step.value)
  if (!valid) {
    showIncompleteWarning.value = true
    return
  }
  nextStep()
}

const handleSubmit = async () => {
  const result = await submitBot()
  if (result) {
    emit('created')
  }
}
</script>
