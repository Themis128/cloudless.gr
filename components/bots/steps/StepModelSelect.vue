<template>
  <div>
    <v-alert type="info" class="mb-4">
      <span v-text="description" />
    </v-alert>
    
    <!-- Model Selection Guide -->
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-subtitle-2 font-weight-bold">
        📖 Read the Model Selection Guide
      </v-card-title>
      <v-card-text>
        <div class="text-body-2">
          <p class="mb-2"><strong>Choose the right AI model for your bot:</strong></p>
          <ul class="mb-3">
            <li><strong>GPT-4:</strong> Most capable, best for complex reasoning and creative tasks</li>
            <li><strong>GPT-3.5-turbo:</strong> Good balance of performance and cost for most use cases</li>
            <li><strong>Claude-3:</strong> Excellent for analysis and detailed explanations</li>
          </ul>
          <v-alert type="info" variant="tonal" class="mb-2">
            <strong>💡 Tip:</strong> Start with GPT-3.5-turbo for most use cases, upgrade to GPT-4 for complex reasoning.
          </v-alert>
        </div>
      </v-card-text>
    </v-card>
    
    <v-select
      :model-value="botStore.builderForm.model"
      :items="models"
      label="Model"
      :error-messages="modelError"
      @update:model-value="updateModel"
      @blur="validateModel"
    />
  </div>
</template>

<script setup lang="ts">
import { useBotStore } from '~/stores/botStore'

const props = defineProps<{
  modelError: string[]
  validateModel: () => void
  description: string
}>()

const botStore = useBotStore()
const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3']

const updateModel = (value: string) => {
  botStore.updateBuilderForm('model', value)
}
</script>
