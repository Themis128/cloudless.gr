<template>
  <v-container fluid max-width="1400" class="mx-auto">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h3 font-weight-bold text-primary mb-6">Admin Dashboard</h1>
      </v-col>
    </v-row>

    <!-- Stats Grid -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3" v-for="stat in statsData" :key="stat.title">
        <v-card class="pa-4 h-100" elevation="4" hover :class="stat.cardClass">
          <v-row align="center" no-gutters>
            <v-col cols="auto">
              <v-avatar :color="stat.iconColor" size="56" class="mr-4">
                <v-icon :icon="stat.icon" size="28" color="white"></v-icon>
              </v-avatar>
            </v-col>
            <v-col>
              <v-card-subtitle class="pa-0 text-caption text-medium-emphasis">
                {{ stat.title }}
              </v-card-subtitle>
              <v-card-title class="pa-0 text-h4 font-weight-bold text-primary">
                {{ stat.value }}
              </v-card-title>
              <div class="text-caption" :class="stat.changeClass">
                {{ stat.change }}
              </div>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dashboard Panels Row -->
    <v-row class="mb-6">
      <!-- Recent Activity Panel -->
      <v-col cols="12" md="6">
        <v-card class="h-100" elevation="4">
          <v-card-title class="text-h5 font-weight-bold text-primary border-b">
            <v-icon icon="mdi-clock-outline" class="mr-2"></v-icon>
            Recent Activity
          </v-card-title>

          <v-card-text class="pa-0">
            <v-list lines="two">
              <v-list-item
                v-for="(activity, index) in recentActivities"
                :key="index"
                :title="activity.text"
                :subtitle="activity.time"
              >
                <template #prepend>
                  <v-avatar :color="activity.color" size="40">
                    <v-icon :icon="activity.icon" color="white"></v-icon>
                  </v-avatar>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>

          <v-card-actions class="justify-center">
            <v-btn variant="outlined" color="primary"> View All Activity </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Quick Actions Panel -->
      <v-col cols="12" md="6">
        <v-card class="h-100" elevation="4">
          <v-card-title class="text-h5 font-weight-bold text-primary border-b">
            <v-icon icon="mdi-lightning-bolt" class="mr-2"></v-icon>
            Quick Actions
          </v-card-title>

          <v-card-text>
            <v-row>
              <v-col cols="6" v-for="action in quickActions" :key="action.title">
                <v-btn
                  :to="action.route"
                  variant="outlined"
                  size="large"
                  block
                  class="flex-column py-4"
                  style="height: auto; min-height: 80px"
                >
                  <v-icon :icon="action.icon" size="24" class="mb-2"></v-icon>
                  <span class="text-caption text-wrap">{{ action.title }}</span>
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- System Status Panel -->
    <v-row>
      <v-col cols="12">
        <v-card elevation="4">
          <v-card-title class="text-h5 font-weight-bold text-primary border-b">
            <v-icon icon="mdi-server" class="mr-2"></v-icon>
            System Status
          </v-card-title>

          <v-card-text>
            <v-row>
              <v-col
                cols="12"
                sm="6"
                md="4"
                lg="2"
                v-for="status in systemStatus"
                :key="status.label"
              >
                <v-card variant="outlined" class="pa-3">
                  <div class="d-flex justify-space-between align-center">
                    <div>
                      <div class="text-caption text-medium-emphasis">{{ status.label }}</div>
                      <div class="text-body-2 font-weight-medium">{{ status.value }}</div>
                    </div>
                    <v-icon :icon="status.icon" :color="status.color" size="20"></v-icon>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { ref } from 'vue';

  // Stats data
  const statsData = ref([
    {
      title: 'Users',
      value: '146',
      change: '+12% this month',
      changeClass: 'text-success',
      icon: 'mdi-account-group',
      iconColor: 'blue',
      cardClass: 'hover-lift',
    },
    {
      title: 'Projects',
      value: '24',
      change: '+3 this month',
      changeClass: 'text-success',
      icon: 'mdi-folder-multiple',
      iconColor: 'green',
      cardClass: 'hover-lift',
    },
    {
      title: 'Contact Submissions',
      value: '38',
      change: '+8 this month',
      changeClass: 'text-success',
      icon: 'mdi-email-multiple',
      iconColor: 'orange',
      cardClass: 'hover-lift',
    },
    {
      title: 'Site Visits',
      value: '2,847',
      change: '+18% this month',
      changeClass: 'text-success',
      icon: 'mdi-eye-multiple',
      iconColor: 'purple',
      cardClass: 'hover-lift',
    },
  ]);

  // Recent activities data
  const recentActivities = ref([
    {
      text: 'John Smith registered a new account',
      time: '10 minutes ago',
      icon: 'mdi-account-plus',
      color: 'blue',
    },
    {
      text: 'New contact submission from Maria Johnson',
      time: '45 minutes ago',
      icon: 'mdi-email',
      color: 'orange',
    },
    {
      text: 'Project updated: E-commerce Website',
      time: '2 hours ago',
      icon: 'mdi-folder-edit',
      color: 'green',
    },
    {
      text: 'Robert Wilson updated their profile',
      time: '3 hours ago',
      icon: 'mdi-account-edit',
      color: 'blue',
    },
    {
      text: 'New project added: AI Content Generator',
      time: 'Yesterday',
      icon: 'mdi-folder-plus',
      color: 'purple',
    },
  ]);

  // Quick actions data
  const quickActions = ref([
    {
      title: 'Manage Users',
      icon: 'mdi-account-group',
      route: '/admin/users',
    },
    {
      title: 'Manage Projects',
      icon: 'mdi-folder-multiple',
      route: '/admin/projects',
    },
    {
      title: 'Review Contacts',
      icon: 'mdi-email-multiple',
      route: '/admin/contact-submissions',
    },
    {
      title: 'Site Settings',
      icon: 'mdi-cog',
      route: '/admin/settings',
    },
    {
      title: 'Analytics',
      icon: 'mdi-chart-line',
      route: '/admin/analytics',
    },
    {
      title: 'Permissions',
      icon: 'mdi-shield-lock',
      route: '/admin/permissions',
    },
  ]);

  // System status data
  const systemStatus = ref([
    {
      label: 'Server Status',
      value: 'Online',
      icon: 'mdi-check-circle',
      color: 'success',
    },
    {
      label: 'Database',
      value: 'Connected',
      icon: 'mdi-check-circle',
      color: 'success',
    },
    {
      label: 'API Health',
      value: '100% Uptime',
      icon: 'mdi-check-circle',
      color: 'success',
    },
    {
      label: 'Storage',
      value: '78% Used',
      icon: 'mdi-alert-circle',
      color: 'warning',
    },
    {
      label: 'Last Backup',
      value: 'Today at 02:00 AM',
      icon: 'mdi-backup-restore',
      color: 'info',
    },
  ]);
</script>
