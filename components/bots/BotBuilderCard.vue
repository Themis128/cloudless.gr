<template>
  <v-card>
    <v-snackbar v-model="showIncompleteWarning" color="warning" timeout="3000">
      Please complete the required fields for this step.
    </v-snackbar>

    <v-progress-linear
      :value="botStore.builderProgress"
      color="primary"
      height="6"
      class="mb-2"
    />

    <v-card-text>
      <!-- Step Guide Component -->
      <StepGuide
        :guide-content="currentGuide?.content"
        :full-guide-content="currentGuide?.fullContent"
        :template-info="currentTemplate"
        :step-number="botStore.builderStep + 1"
        :step-name="currentGuide?.title || `Step ${botStore.builderStep + 1}`"
        @load-template="handleLoadTemplate"
      />

      <div v-if="botStore.builderStep === 0">
        <StepBotDetails
          :name-error="botStore.validationErrors.name ? [botStore.validationErrors.name] : []"
          :prompt-error="botStore.validationErrors.prompt ? [botStore.validationErrors.prompt] : []"
          :validate-name="() => botStore.validateField('name')"
          :validate-prompt="() => botStore.validateField('prompt')"
          :description="botStore.currentBuilderStep?.description || ''"
        />
        <div class="mt-4">
          <v-btn 
            color="primary" 
            @click="handleNextStep"
            :disabled="!botStore.canProceedToNextStep"
          >
            Continue
          </v-btn>
        </div>
      </div>
      <div v-else-if="botStore.builderStep === 1">
        <StepModelSelect
          :model-error="botStore.validationErrors.model ? [botStore.validationErrors.model] : []"
          :validate-model="() => botStore.validateField('model')"
          :description="botStore.currentBuilderStep?.description || ''"
        />
        <div class="mt-4">
          <v-btn class="me-2" @click="botStore.prevBuilderStep">
            Back
          </v-btn>
          <v-btn 
            color="primary" 
            @click="handleNextStep"
            :disabled="!botStore.canProceedToNextStep"
          >
            Continue
          </v-btn>
        </div>
      </div>
      <div v-else-if="botStore.builderStep === 2">
        <StepSettings :description="botStore.currentBuilderStep?.description || ''" />
        <div class="mt-4">
          <v-btn class="me-2" @click="botStore.prevBuilderStep">
            Back
          </v-btn>
          <v-btn color="primary" @click="handleNextStep">
            Continue
          </v-btn>
        </div>
      </div>
      <div v-else-if="botStore.builderStep === 3">
        <StepSummary />
        <div class="mt-4">
          <v-btn class="me-2" @click="botStore.prevBuilderStep">
            Back
          </v-btn>
          <v-btn 
            success 
            :loading="botStore.loading" 
            @click="handleSubmit"
            :disabled="botStore.hasValidationErrors"
          >
            Create Bot
          </v-btn>
        </div>
      </div>
    </v-card-text>

    <v-alert v-if="botStore.error" type="error" class="mt-2">
      {{ botStore.error }}
    </v-alert>
    <v-alert v-if="botStore.success" type="success" class="mt-2">
      Bot created successfully!
    </v-alert>
  </v-card>
</template>

<script setup lang="ts">
import StepBotDetails from '~/components/bots/steps/StepBotDetails.vue'
import StepModelSelect from '~/components/bots/steps/StepModelSelect.vue'
import StepSettings from '~/components/bots/steps/StepSettings.vue'
import StepSummary from '~/components/bots/steps/StepSummary.vue'
import StepGuide from '~/components/ui/StepGuide.vue'

import { computed, ref, watch } from 'vue'
import { useBotStore } from '~/stores/botStore'
import { useStepGuides } from '~/composables/useStepGuides'

const props = defineProps<{ template?: any }>()
const emit = defineEmits(['created'])

// Use the enhanced bot store
const botStore = useBotStore()

// Step guides integration
const { currentGuide, currentTemplate } = useStepGuides('bot', botStore.builderStep)

const showIncompleteWarning = ref(false)

// Watch for step changes to update progress
watch(() => botStore.builderStep, () => {
  // Progress is automatically calculated in the store getter
})

const handleNextStep = () => {
  if (!botStore.canProceedToNextStep) {
    showIncompleteWarning.value = true
    return
  }
  botStore.nextBuilderStep()
}

const handleSubmit = async () => {
  const success = await botStore.submitBuilder()
  if (success) {
    emit('created')
  }
}

const handleLoadTemplate = (template: any) => {
  // Update store with template data
  if (template.name) botStore.updateBuilderForm('name', template.name)
  if (template.prompt) botStore.updateBuilderForm('prompt', template.prompt)
  if (template.model) botStore.updateBuilderForm('model', template.model)
  if (template.memory) botStore.updateBuilderForm('memory', template.memory)
  if (template.tools) botStore.updateBuilderForm('tools', template.tools)
}
</script>
