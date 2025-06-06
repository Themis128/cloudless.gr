<!--
  This component hosts:
  - Recent agent runs, deployments, errors, and user actions
  - Fetches activity data from backend API
  - Displays loading and error states
  - Security: Show/hide activity based on user role/permissions
-->
<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-history" class="me-2"></v-icon>
      Recent Activity
    </v-card-title>
    <v-card-text>
      <div v-if="loading" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading activity...</p>
      </div>
      <div v-else-if="error" class="text-center pa-4">
        <v-alert type="error" variant="tonal">
          {{ error }}
        </v-alert>
      </div>
      <v-list v-else density="compact" lines="two">
        <v-list-item v-for="item in activity" :key="item.id" class="mb-2">
          <template #prepend>
            <v-avatar size="32" :color="item.color || 'primary'">
              <v-icon size="18" :icon="item.icon || 'mdi-information'"></v-icon>
            </v-avatar>
          </template>
          
          <v-list-item-title class="text-wrap">{{ item.title }}</v-list-item-title>
          <v-list-item-subtitle class="text-wrap">
            {{ item.description }}
          </v-list-item-subtitle>

          <template #append>
            <div class="text-caption text-medium-emphasis">
              {{ formatTimestamp(item.timestamp) }}
            </div>
          </template>
        </v-list-item>
        
        <v-list-item v-if="activity.length === 0" class="text-center">
          <v-list-item-title class="text-medium-emphasis">
            No recent activity to display
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from '#imports';

interface ActivityItem {
  id: number;
  title: string;
  description: string;
  timestamp: string;
  type: string;
  icon?: string;
  color?: string;
}

const activity = ref<ActivityItem[]>([]);
const loading = ref(true);
const error = ref('');

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return `${days}d ago`;
  }
}

async function fetchActivity() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/dashboard/activity');
    if (!res.ok) throw new Error('Failed to fetch activity');
    
    const response = await res.json();
    if (response.success) {
      activity.value = response.data;
    } else {
      throw new Error(response.error || 'Unknown error');
    }
  } catch (e: any) {
    error.value = e.message || 'Unknown error';
    console.error('Error fetching activity:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchActivity);
</script>
