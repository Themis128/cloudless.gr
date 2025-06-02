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
      <div v-if="loading">Loading stats...</div>
      <div v-else-if="error">Error: {{ error }}</div>
      <div v-else>
        <v-row>
          <v-col>
            <div class="text-center">
              <div class="text-h4 text-primary">{{ stats.agents }}</div>
              <div class="text-caption text-medium-emphasis">Agents</div>
            </div>
          </v-col>
          <v-col>
            <div class="text-center">
              <div class="text-h4 text-primary">{{ stats.workflows }}</div>
              <div class="text-caption text-medium-emphasis">Workflows</div>
            </div>
          </v-col>
          <v-col>
            <div class="text-center">
              <div class="text-h4 text-primary">
                {{ stats.memory_usage ? `${stats.memory_usage}MB` : '-' }}
              </div>
              <div class="text-caption text-medium-emphasis">Memory</div>
            </div>
          </v-col>
        </v-row>
        <v-row class="mt-4">
          <v-col>
            <div class="text-center">
              <div class="text-h4 text-primary">{{ stats.workflows_today }}</div>
              <div class="text-caption text-medium-emphasis">Workflows Today</div>
            </div>
          </v-col>
        </v-row>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from '#imports';

const stats = ref({ agents: 0, workflows: 0, users: 0, modelUsage: 'N/A' });
const loading = ref(true);
const error = ref('');

async function fetchStats() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    stats.value = await res.json();
  } catch (e: any) {
    error.value = e.message || 'Unknown error';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchStats);
</script>
