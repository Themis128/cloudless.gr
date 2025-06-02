<script setup lang="ts">
  import { onMounted } from '#imports';
import DashboardStats from '~/components/dashboard/DashboardStats.vue';
import RecentActivity from '~/components/dashboard/RecentActivity.vue';
import { useAuth } from '~/composables/useAuth';
import { usePlatformStats } from '~/composables/usePlatformStats';

  const { user } = useAuth();
  const { stats, fetchStats, loading } = usePlatformStats();

  onMounted(() => {
    fetchStats();
  });
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1>Welcome, {{ user?.name || 'Guest' }}</h1>
      </v-col>
      <v-col cols="12" md="4">
        <DashboardStats :stats="stats" :loading="loading" />
      </v-col>
      <v-col cols="12" md="8">
        <RecentActivity />
      </v-col>
    </v-row>
  </v-container>
</template>
