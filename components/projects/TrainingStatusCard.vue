<template>
  <v-card>
    <v-card-title>Training Status</v-card-title>
    <v-card-text>
      <div v-if="session">
        <div><strong>Status:</strong> {{ session.status }}</div>
        <div><strong>Progress:</strong> {{ session.progress || 0 }}%</div>
        <div><strong>Epoch:</strong> {{ session.currentEpoch || 0 }} / {{ session.totalEpochs || 0 }}</div>
      </div>
      <div v-else>
        No active training session.
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import type { TrainingSession } from '~/types/project';
const props = defineProps<{ session?: TrainingSession | null }>();
</script>
