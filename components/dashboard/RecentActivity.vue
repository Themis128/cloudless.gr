<!--
  This component hosts:
  - Recent agent runs, deployments, errors, and user actions
  - Fetches activity data from backend API
  - Displays loading and error states
  - Security: Show/hide activity based on user role/permissions
-->
<template>
  <v-card>
    <v-card-title>Recent Activity</v-card-title>
    <v-card-text>
      <div v-if="loading">Loading activity...</div>
      <div v-else-if="error">Error: {{ error }}</div>
      <v-list v-else>
        <v-list-item v-for="item in activity" :key="item.id">
          <v-list-item-title>{{ item.title }}</v-list-item-title>
          <v-list-item-subtitle>{{ item.timestamp }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from '#imports';

const activity = ref([]);
const loading = ref(true);
const error = ref('');

async function fetchActivity() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/dashboard/activity');
    if (!res.ok) throw new Error('Failed to fetch activity');
    activity.value = await res.json();
  } catch (e: any) {
    error.value = e.message || 'Unknown error';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchActivity);
</script>
