<template>
  <div>
    <v-alert type="info" class="mb-4">
      <span v-text="description" />
    </v-alert>
    
    <!-- Settings Configuration Guide -->
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-subtitle-2 font-weight-bold">
        📖 Read the Settings Configuration Guide
      </v-card-title>
      <v-card-text>
        <div class="text-body-2">
          <p class="mb-2"><strong>Configure your bot's behavior and capabilities:</strong></p>
          <ul class="mb-3">
            <li><strong>Memory Context:</strong> How much conversation history to remember (1000-16000 tokens)</li>
            <li><strong>Tools:</strong> Additional capabilities like knowledge base, ticket system, etc.</li>
          </ul>
          <v-alert type="info" variant="tonal" class="mb-2">
            <strong>💡 Tip:</strong> Start with 4000 tokens for memory and add tools based on your bot's needs.
          </v-alert>
        </div>
      </v-card-text>
    </v-card>
    
    <v-text-field
      :model-value="botStore.builderForm.memory"
      label="Memory Context"
      @update:model-value="updateMemory"
    >
      <template #append>
        <v-tooltip text="Context window for bot memory (optional)">
          <v-icon>mdi-help-circle</v-icon>
        </v-tooltip>
      </template>
    </v-text-field>
    <v-text-field
      :model-value="botStore.builderForm.tools"
      label="Tools (comma-separated)"
      @update:model-value="updateTools"
    >
      <template #append>
        <v-tooltip text="Comma-separated tool names (optional)">
          <v-icon>mdi-help-circle</v-icon>
        </v-tooltip>
      </template>
    </v-text-field>
  </div>
</template>

<script setup lang="ts">
import { useBotStore } from '~/stores/botStore'

const props = defineProps<{
  description: string
}>()

const botStore = useBotStore()

const updateMemory = (value: string) => {
  botStore.updateBuilderForm('memory', value)
}

const updateTools = (value: string) => {
  botStore.updateBuilderForm('tools', value)
}
</script>
