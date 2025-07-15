<template>
  <BotGuide />
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <BotWizard @created="onCreated" />
        <v-alert type="info" class="mt-4">
          <strong>How to use:</strong> Fill in each step of the wizard to configure your bot. Advanced settings are optional. Review the summary before creating your bot.
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import BotGuide from '~/components/step-guides/BotGuide.vue'
import BotWizard from '~/components/bots/BotWizard.vue'

function onCreated() {
  // Placeholder for additional logic after creation (e.g., analytics, notification)
}
</script>
