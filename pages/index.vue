<!--
  This page can host:
  - The main dashboard/home for the platform
  - Welcome message and user context (personalized greeting)
  - Quick stats (agent count, workflow status, resource usage)
  - Recent activity feed (agent runs, deployments, errors)
  - Entry points to agent builder, orchestrator, and settings
  - Security: Show/hide content based on user role/permissions
-->
<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1>Welcome, {{ user?.name || 'Guest' }}</h1>
      </v-col>
      <v-col cols="12" md="6">
        <DashboardStats />
      </v-col>
      <v-col cols="12" md="6">
        <RecentActivity />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import DashboardStats from '~/components/dashboard/DashboardStats.vue';
import RecentActivity from '~/components/dashboard/RecentActivity.vue';
import { useAuth } from '~/composables/useAuth';

  const { user } = useAuth();
</script>

<style scoped>
  /* Add any component-specific styles here */
</style>
