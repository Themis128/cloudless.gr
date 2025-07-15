<template>
  <div class="mb-4" v-if="wizard.current.value && wizard.current.value.description">
    <v-alert type="info" border="start" variant="tonal" class="mb-4">
      <div v-html="wizard.current.value.description" />
    </v-alert>
  </div>
  <BotGuide />
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
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <BotWizard @created="onCreated" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">

import BotGuide from '~/components/step-guides/BotGuide.vue'
import BotWizard from '~/components/bots/BotWizard.vue'
import { useWizard } from '~/composables/useWizard'

// Wizard stepper integration
const wizard = useWizard()

function onCreated() {
  // Placeholder for additional logic after creation (e.g., analytics, notification)
}
</script>
