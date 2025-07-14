<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <BotWizard @created="onCreated" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import BotWizard from '~/components/bots/BotWizard.vue'

function onCreated() {
  // Placeholder for additional logic after creation (e.g., analytics, notification)
}
</script>
