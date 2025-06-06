<!--
  This component hosts:
  - Platform stats: agent count, workflow status, resource usage, model usage, etc.
  - Fetches data from backend API
  - Displays loading and error states
  - Security: Show/hide stats based on user role/permissions
-->
<template>
  <v-card>
    <v-card-title>Platform Stats</v-card-title>
    <v-card-text>
      <div v-if="loading" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading stats...</p>
      </div>
      <div v-else-if="error" class="text-center pa-4">
        <v-alert type="error" variant="tonal">
          {{ error }}
        </v-alert>
      </div>
      <div v-else>
        <v-row>
          <v-col cols="4">
            <div class="text-center">
              <div class="text-h4 text-primary">{{ stats?.agents || 0 }}</div>
              <div class="text-caption text-medium-emphasis">Agents</div>
            </div>
          </v-col>
          <v-col cols="4">
            <div class="text-center">
              <div class="text-h4 text-primary">{{ stats?.workflows || 0 }}</div>
              <div class="text-caption text-medium-emphasis">Workflows</div>
            </div>
          </v-col>
          <v-col cols="4">
            <div class="text-center">
              <div class="text-h4 text-primary">
                {{ stats?.memory_usage ? `${stats.memory_usage}MB` : '-' }}
              </div>
              <div class="text-caption text-medium-emphasis">Memory</div>
            </div>
          </v-col>
        </v-row>
        <v-row class="mt-4">
          <v-col cols="6">
            <div class="text-center">
              <div class="text-h4 text-success">{{ stats?.active_sessions || 0 }}</div>
              <div class="text-caption text-medium-emphasis">Active Sessions</div>
            </div>
          </v-col>
          <v-col cols="6">
            <div class="text-center">
              <div class="text-h4 text-info">{{ stats?.total_executions || 0 }}</div>
              <div class="text-caption text-medium-emphasis">Total Executions</div>
            </div>
          </v-col>
        </v-row>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Props {
  stats: any;
  loading: boolean;
  error?: string | null;
}

defineProps<Props>();
</script>
