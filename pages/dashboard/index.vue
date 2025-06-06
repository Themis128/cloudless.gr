<script setup lang="ts">
import DashboardStats from '~/components/dashboard/DashboardStats.vue';
import RecentActivity from '~/components/dashboard/RecentActivity.vue';
import { useAuth } from '~/composables/useAuth';
import { usePlatformStats } from '~/composables/usePlatformStats';
import { onMounted, computed } from '#imports';

// Protect this page with auth middleware
definePageMeta({
  middleware: '06-auth-required',
  layout: 'default'
});

const { user } = useAuth();
const { stats, fetchStats, loading } = usePlatformStats();

// Computed properties for better reactivity
const userDisplayName = computed(() => user.value?.name || user.value?.email || 'Guest');
const isAdmin = computed(() => user.value?.role === 'admin');

onMounted(() => {
  fetchStats();
});
</script>

<template>
  <v-container fluid class="pa-6">
    <v-row>
      <!-- Welcome Header -->
      <v-col cols="12">
        <v-card class="mb-6" elevation="2">
          <v-card-text class="pa-6">
            <div class="d-flex align-center">
              <v-avatar size="48" color="primary" class="me-4">
                <v-icon size="24">mdi-account-circle</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold mb-1">
                  Welcome back, {{ userDisplayName }}
                </h1>
                <p class="text-body-1 text-medium-emphasis mb-0">
                  Here's what's happening with your projects today
                </p>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Quick Stats -->
      <v-col cols="12" md="4">
        <DashboardStats :stats="stats" :loading="loading" />
      </v-col>

      <!-- Recent Activity -->
      <v-col cols="12" md="8">
        <RecentActivity />
      </v-col>

      <!-- Quick Actions -->
      <v-col cols="12">
        <v-card class="mt-4">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-lightning-bolt" class="me-2"></v-icon>
            Quick Actions
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  color="primary"
                  to="/builder"
                  variant="tonal"
                  block
                  size="large"
                  prepend-icon="mdi-plus"
                >
                  New Project
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  color="success"
                  to="/agents"
                  variant="tonal"
                  block
                  size="large"
                  prepend-icon="mdi-robot"
                >
                  AI Agents
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  color="info"
                  to="/workflows"
                  variant="tonal"
                  block
                  size="large"
                  prepend-icon="mdi-workflow"
                >
                  Workflows
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3" v-if="isAdmin">
                <v-btn
                  color="warning"
                  to="/admin"
                  variant="tonal"
                  block
                  size="large"
                  prepend-icon="mdi-cog"
                >
                  Admin Panel
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- System Status (Admin only) -->
      <v-col cols="12" v-if="isAdmin">
        <v-card class="mt-4">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-monitor-dashboard" class="me-2"></v-icon>
            System Overview
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-list density="compact">
                  <v-list-item>
                    <template #prepend>
                      <v-icon color="success">mdi-check-circle</v-icon>
                    </template>
                    <v-list-item-title>Database Status</v-list-item-title>
                    <template #append>
                      <v-chip color="success" size="small">Online</v-chip>
                    </template>
                  </v-list-item>
                  <v-list-item>
                    <template #prepend>
                      <v-icon color="success">mdi-check-circle</v-icon>
                    </template>
                    <v-list-item-title>API Status</v-list-item-title>
                    <template #append>
                      <v-chip color="success" size="small">Healthy</v-chip>
                    </template>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-col cols="12" md="6">
                <v-btn
                  color="primary"
                  to="/admin/dashboard"
                  variant="outlined"
                  block
                  prepend-icon="mdi-view-dashboard"
                >
                  Full Admin Dashboard
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-card {
  transition: transform 0.2s ease-in-out;
}

.v-card:hover {
  transform: translateY(-2px);
}
</style>
