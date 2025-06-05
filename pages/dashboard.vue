<script setup lang="ts">
import DashboardStats from '~/components/dashboard/DashboardStats.vue';
import RecentActivity from '~/components/dashboard/RecentActivity.vue';
import { useAuth } from '~/composables/useAuth';
import { usePlatformStats } from '~/composables/usePlatformStats';
import { onMounted } from '#imports';

// Protect this page with auth middleware
definePageMeta({
  middleware: 'auth-required'
});

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
        <h1 class="text-h4 font-weight-bold mb-4">Welcome, {{ user?.name || 'Guest' }}</h1>
      </v-col>
      <v-col cols="12" md="4">
        <DashboardStats :stats="stats" :loading="loading" />
      </v-col>
      <v-col cols="12" md="8">
        <RecentActivity />
      </v-col>
      <v-col cols="12" v-if="user?.role === 'admin'">
        <v-btn color="primary" to="/admin" class="mt-4" block>
          Go to Admin Dashboard
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
