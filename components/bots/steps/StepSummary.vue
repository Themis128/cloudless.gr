<template>
  <div>
    <!-- Review & Create Guide -->
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-subtitle-2 font-weight-bold">
        📖 Read the Review & Create Guide
      </v-card-title>
      <v-card-text>
        <div class="text-body-2">
          <p class="mb-2"><strong>Review your bot configuration before creating:</strong></p>
          <ul class="mb-3">
            <li>Verify all information is correct and complete</li>
            <li>Check that the bot name and description are clear</li>
            <li>Review the prompt for clarity and completeness</li>
            <li>Confirm model selection and settings are appropriate</li>
          </ul>
          <v-alert type="success" variant="tonal" class="mb-2">
            <strong>✅ Ready to Create:</strong> Your bot will be created with the specified configuration. You can test and modify it after creation.
          </v-alert>
        </div>
      </v-card-text>
    </v-card>
    
    <v-card variant="outlined">
      <v-card-title class="text-subtitle-2 font-weight-bold">
        📋 Bot Configuration Summary
      </v-card-title>
      <v-card-text>
        <v-list>
          <v-list-item><strong>Name:</strong> {{ botStore.builderForm.name }}</v-list-item>
          <v-list-item><strong>Prompt:</strong> {{ botStore.builderForm.prompt }}</v-list-item>
          <v-list-item><strong>Model:</strong> {{ botStore.builderForm.model }}</v-list-item>
          <v-list-item><strong>Memory Context:</strong> {{ botStore.builderForm.memory }}</v-list-item>
          <v-list-item><strong>Tools:</strong> {{ botStore.builderForm.tools }}</v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useBotStore } from '~/stores/botStore'

const botStore = useBotStore()
</script>
