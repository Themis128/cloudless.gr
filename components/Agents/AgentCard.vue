<template>  <v-card class="agent-card" :loading="props.loading">
    <v-card-title class="d-flex align-center">
      {{ props.agent.name }}
      <v-chip :color="props.agent.status === 'active' ? 'success' : 'error'" class="ml-2" size="small">
        {{ props.agent.status }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <p class="text-body-1">{{ props.agent.description }}</p>
      <v-list density="compact">
        <v-list-item>
          <template #prepend>
            <v-icon>mdi-brain</v-icon>
          </template>
          <v-list-item-title>Model: {{ props.agent.model }}</v-list-item-title>
        </v-list-item>
        <v-list-item>
          <template #prepend>
            <v-icon>mdi-memory</v-icon>
          </template>
          <v-list-item-title>Memory: {{ props.agent.memoryType }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card-text>

    <v-card-actions>
      <v-btn variant="text" color="primary" :to="`/agents/${props.agent.id}`"> View Details </v-btn>
      <v-btn variant="text" color="error" @click="emit('delete', props.agent.id)"> Delete </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import type { Agent } from '~/types/agents';

const props = defineProps<{
  agent: Agent;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'delete', id: string): void;
}>();
</script>

<style scoped>
.agent-card {
  transition: transform 0.2s;
}

.agent-card:hover {
  transform: translateY(-4px);
}
</style>
