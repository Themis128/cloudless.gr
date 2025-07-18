<template>
  <v-card class="pipeline-builder-card">
    <v-card-title class="d-flex align-center">
      <v-icon start>
        mdi-pipe
      </v-icon>
      Create Pipeline
    </v-card-title>
    <v-card-text>
      <p class="mb-4">
        Build a new pipeline to automate your workflows.
      </p>
      <v-list>
        <v-list-item prepend-icon="mdi-cog-outline">
          Configure steps and logic
        </v-list-item>
        <v-list-item prepend-icon="mdi-connection">
          Connect to models and bots
        </v-list-item>
        <v-list-item prepend-icon="mdi-chart-timeline-variant">
          Monitor execution and results
        </v-list-item>
      </v-list>
    </v-card-text>
    <v-card-actions>
      <v-btn
        color="primary"
        block
        :to="to"
        :disabled="disabled"
      >
        Get Started
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  to: string;
  disabled?: boolean;
}>();
</script>

<style scoped>
.pipeline-builder-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pipeline-builder-card :deep(.v-card-text) {
  flex-grow: 1;
}
</style>
