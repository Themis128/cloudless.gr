<template>
  <v-card elevation="2" rounded="lg" class="tool-card" hover>
    <v-card-title class="text-h6 font-weight-bold text-primary">
      {{ toolName }}
    </v-card-title>
    <v-card-text v-if="description" class="text-body-1 text-medium-emphasis">
      {{ description }}
    </v-card-text>
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
  transition: transform 0.2s ease-in-out;
}

.tool-card:hover {
  transform: translateY(-2px);
}
</style>
