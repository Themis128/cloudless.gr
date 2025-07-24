<template>
  <div>
    <v-alert type="info" class="mb-4">
      <span v-text="description" />
    </v-alert>
    
    <!-- Bot Details Guide -->
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-subtitle-2 font-weight-bold">
        📖 Read the Bot Details Guide
      </v-card-title>
      <v-card-text>
        <div class="text-body-2">
          <p class="mb-2"><strong>Define your bot's basic information and personality:</strong></p>
          <ul class="mb-3">
            <li><strong>Bot Name:</strong> Choose a descriptive name that clearly identifies your bot's purpose</li>
            <li><strong>Prompt:</strong> Define the bot's personality, role, and behavior instructions</li>
            <li><strong>Description:</strong> Provide a brief overview of what your bot does</li>
          </ul>
          <v-alert type="info" variant="tonal" class="mb-2">
            <strong>💡 Tip:</strong> Use clear, specific names and write detailed prompts that define the bot's role and limitations.
          </v-alert>
        </div>
      </v-card-text>
    </v-card>
    
    <v-text-field
      :model-value="botStore.builderForm.name"
      label="Bot Name"
      :error-messages="nameError"
      @update:model-value="updateName"
      @blur="validateName"
    />
    <div class="d-flex align-center mb-2">
      <v-textarea
        :model-value="botStore.builderForm.prompt"
        label="Prompt"
        auto-grow
        :error-messages="promptError"
        class="flex-grow-1"
        @update:model-value="updatePrompt"
        @blur="validatePrompt"
      />
      <v-tooltip location="top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            icon
            v-bind="tooltipProps"
            variant="text"
            class="ms-2"
          >
            <v-icon>mdi-help-circle</v-icon>
          </v-btn>
        </template>
        <span>{{ promptHelp }}</span>
      </v-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePromptHelp } from '~/composables/usePromptHelp';
import { useBotStore } from '~/stores/botStore'

const props = defineProps<{
  nameError: string[]
  promptError: string[]
  validateName: () => void
  validatePrompt: () => void
  description: string
}>()

const botStore = useBotStore()
const promptHelp = usePromptHelp()

const updateName = (value: string) => {
  botStore.updateBuilderForm('name', value)
}

const updatePrompt = (value: string) => {
  botStore.updateBuilderForm('prompt', value)
}
</script>
