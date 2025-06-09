<template>
  <v-card class="tool-card">
    <v-card-title class="text-h5">{{ toolName }}</v-card-title>
    <v-card-text class="text-body-1">{{ description }}</v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  interface ToolCardProps {
    toolName: string;
    description?: string;
  }

  defineProps<ToolCardProps>();
</script>

<style scoped>
  .tool-card {
    background: rgba(255, 255, 255, 0.85) !important;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .tool-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.12) !important;
  }
</style>
