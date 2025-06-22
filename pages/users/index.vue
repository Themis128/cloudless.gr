<template>
  <div class="users-dashboard">
    <v-container class="py-8">
      <!-- Welcome Header -->
      <v-row class="mb-6">
        <v-col cols="12">
          <div class="welcome-section">
            <v-row align="center">
              <v-col cols="12" md="8">
                <div class="d-flex align-center">
                  <v-avatar v-if="userProfile?.avatar_url" size="80" class="me-4">
                    <v-img :src="userProfile.avatar_url" :alt="userDisplayName" />
                  </v-avatar>
                  <v-avatar
                    v-else
                    size="80"
                    color="primary"
                    class="me-4"
                  >
                    <span class="text-h4 font-weight-bold">{{ userInitials }}</span>
                  </v-avatar>
                  <div>
                    <h1 class="text-h4 font-weight-bold mb-2">Welcome, {{ userDisplayName }}!</h1>
                    <p class="text-h6 text-grey-darken-1">{{ welcomeMessage }}</p>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="4" class="text-right">
                <v-btn
                  color="primary"
                  variant="elevated"
                  size="large"
                  prepend-icon="mdi-account-edit"
                  @click="$router.push('/users/profile/edit')"
                >
                  Edit Profile
                </v-btn>
              </v-col>
            </v-row>
          </div>
        </v-col>
      </v-row>

      <!-- Quick Stats -->
      <v-row class="mb-6">
        <v-col cols="12" sm="6" md="3">
          <v-card class="text-center pa-4" variant="outlined">
            <v-icon size="48" color="primary" class="mb-2">mdi-folder-multiple</v-icon>
            <div class="text-h5 font-weight-bold">{{ userStats.projects }}</div>
            <div class="text-body-2 text-grey-darken-1">Projects</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card class="text-center pa-4" variant="outlined">
            <v-icon size="48" color="success" class="mb-2">mdi-chart-line</v-icon>
            <div class="text-h5 font-weight-bold">{{ userStats.activeProjects }}</div>
            <div class="text-body-2 text-grey-darken-1">Active</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card class="text-center pa-4" variant="outlined">
            <v-icon size="48" color="warning" class="mb-2">mdi-clock-outline</v-icon>
            <div class="text-h5 font-weight-bold">{{ userStats.lastActive }}</div>
            <div class="text-body-2 text-grey-darken-1">Last Active</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card class="text-center pa-4" variant="outlined">
            <v-icon size="48" color="info" class="mb-2">mdi-database</v-icon>
            <div class="text-h5 font-weight-bold">{{ userStats.storageUsed }}</div>
            <div class="text-body-2 text-grey-darken-1">Storage Used</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Main Content Grid -->
      <v-row>
        <!-- User Profile Section -->
        <v-col cols="12" md="6">
          <v-card class="elevation-2 mb-4">
            <v-card-title class="text-h6 font-weight-bold text-primary pa-4">
              <v-icon class="mr-2">mdi-account-circle</v-icon>
              Profile Information
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-4">
              <v-list density="compact">
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-email</v-icon>
                  </template>
                  <v-list-item-title>{{ user?.email }}</v-list-item-title>
                  <v-list-item-subtitle>Email Address</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-account</v-icon>
                  </template>
                  <v-list-item-title>{{ userProfile?.first_name }} {{ userProfile?.last_name }}</v-list-item-title>
                  <v-list-item-subtitle>Full Name</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-shield-check</v-icon>
                  </template>
                  <v-list-item-title>
                    <v-chip 
                      :color="user?.email_confirmed_at ? 'success' : 'warning'" 
                      size="small"
                    >
                      {{ user?.email_confirmed_at ? 'Verified' : 'Unverified' }}
                    </v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle>Email Status</v-list-item-subtitle>
                </v-list-item>
              </v-list>
              <v-btn
                variant="outlined"
                color="primary"
                size="small"
                class="mt-3"
                @click="$router.push('/users/profile')"
              >
                View Full Profile
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Quick Actions Section -->
        <v-col cols="12" md="6">
          <v-card class="elevation-2 mb-4">
            <v-card-title class="text-h6 font-weight-bold text-primary pa-4">
              <v-icon class="mr-2">mdi-lightning-bolt</v-icon>
              Quick Actions
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-0">
              <v-list>
                <v-list-item
                  prepend-icon="mdi-plus-circle"
                  title="Create New Project"
                  subtitle="Start a new analytics project"
                  @click="$router.push('/projects/create')"
                >
                  <template #append>
                    <v-icon>mdi-chevron-right</v-icon>
                  </template>
                </v-list-item>
                <v-divider />
                <v-list-item
                  prepend-icon="mdi-cog"
                  title="Account Settings"
                  subtitle="Manage your account preferences"
                  @click="$router.push('/users/account')"
                >
                  <template #append>
                    <v-icon>mdi-chevron-right</v-icon>
                  </template>
                </v-list-item>
                <v-divider />
                <v-list-item
                  prepend-icon="mdi-bell"
                  title="Notifications"
                  subtitle="Manage notification settings"
                  @click="$router.push('/users/notifications')"
                >
                  <template #append>
                    <v-badge v-if="unreadNotifications > 0" :content="unreadNotifications" color="error">
                      <v-icon>mdi-chevron-right</v-icon>
                    </v-badge>
                    <v-icon v-else>mdi-chevron-right</v-icon>
                  </template>
                </v-list-item>
                <v-divider />
                <v-list-item
                  prepend-icon="mdi-history"
                  title="Activity Log"
                  subtitle="View your recent activity"
                  @click="$router.push('/users/activity')"
                >
                  <template #append>
                    <v-icon>mdi-chevron-right</v-icon>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Recent Activity -->
        <v-col cols="12" md="8">
          <v-card class="elevation-2">
            <v-card-title class="text-h6 font-weight-bold text-primary pa-4">
              <v-icon class="mr-2">mdi-history</v-icon>
              Recent Activity
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-0">
              <v-list v-if="recentActivity.length > 0">
                <v-list-item
                  v-for="(activity, index) in recentActivity"
                  :key="index"
                  :prepend-icon="activity.icon"
                  :title="activity.title"
                  :subtitle="activity.description"
                >
                  <template #append>
                    <div class="text-caption text-grey-darken-1">
                      {{ formatDate(activity.timestamp) }}
                    </div>
                  </template>
                </v-list-item>
              </v-list>
              <div v-else class="pa-8 text-center">
                <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-history</v-icon>
                <p class="text-h6 text-grey-darken-1">No recent activity</p>
                <p class="text-body-2 text-grey-darken-2">Your activity will appear here once you start using the platform</p>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Account Status -->
        <v-col cols="12" md="4">
          <v-card class="elevation-2">
            <v-card-title class="text-h6 font-weight-bold text-primary pa-4">
              <v-icon class="mr-2">mdi-shield-check</v-icon>
              Account Status
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-4">
              <div class="mb-4">
                <div class="d-flex justify-space-between align-center mb-2">
                  <span class="text-body-2">Profile Completion</span>
                  <span class="text-caption">{{ profileCompletionPercentage }}%</span>
                </div>
                <v-progress-linear
                  :model-value="profileCompletionPercentage"
                  color="primary"
                  height="8"
                  rounded
                />
              </div>
              
              <v-list density="compact">
                <v-list-item>
                  <template #prepend>
                    <v-icon :color="user?.email_confirmed_at ? 'success' : 'warning'">
                      {{ user?.email_confirmed_at ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>Email Verification</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon :color="userProfile?.first_name ? 'success' : 'warning'">
                      {{ userProfile?.first_name ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>Profile Information</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon :color="userProfile?.avatar_url ? 'success' : 'warning'">
                      {{ userProfile?.avatar_url ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>Profile Picture</v-list-item-title>
                </v-list-item>
              </v-list>

              <v-btn
                v-if="profileCompletionPercentage < 100"
                variant="outlined"
                color="primary"
                size="small"
                class="mt-3"
                block
                @click="$router.push('/users/profile/edit')"
              >
                Complete Profile
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Project } from '~/types/supabase';

// Define page meta
definePageMeta({
  layout: 'user',
  middleware: 'auth',
  name: 'User Dashboard',
  title: 'Dashboard - Cloudless.gr'
});

// SEO
useHead({
  title: 'User Dashboard - Cloudless.gr',
  meta: [
    {
      name: 'description',
      content: 'Manage your Cloudless.gr account, view projects, and track your activity.'
    }
  ]
});

// Composables and stores
const { user } = useSupabaseAuth();
const userProfileStore = useUserProfileStore();

// Reactive data
const userStats = ref({
  projects: 0,
  activeProjects: 0,
  lastActive: 'Today',
  storageUsed: '0 MB'
});

const recentActivity = ref([
  {
    icon: 'mdi-account-plus',
    title: 'Account created',
    description: 'Welcome to Cloudless.gr!',
    timestamp: new Date()
  }
]);

const unreadNotifications = ref(0);

// Computed properties
const userProfile = computed(() => userProfileStore.userProfile);

const userDisplayName = computed(() => {
  if (userProfile.value?.first_name && userProfile.value?.last_name) {
    return `${userProfile.value.first_name} ${userProfile.value.last_name}`;
  }
  if (userProfile.value?.first_name) {
    return userProfile.value.first_name;
  }
  if (userProfile.value?.full_name) {
    return userProfile.value.full_name;
  }
  return user.value?.email?.split('@')[0] || 'User';
});

const userInitials = computed(() => {
  if (userProfile.value?.first_name && userProfile.value?.last_name) {
    return `${userProfile.value.first_name[0]}${userProfile.value.last_name[0]}`.toUpperCase();
  }
  if (userProfile.value?.first_name) {
    return userProfile.value.first_name[0].toUpperCase();
  }
  if (user.value?.email) {
    return user.value.email[0].toUpperCase();
  }
  return 'U';
});

const welcomeMessage = computed(() => {
  const hour = new Date().getHours();
  let greeting = 'Good day';
  
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else greeting = 'Good evening';
  
  return `${greeting}! Here's your dashboard overview.`;
});

const profileCompletionPercentage = computed(() => {
  let completed = 0;
  const total = 4;
  
  if (user.value?.email_confirmed_at) completed++;
  if (userProfile.value?.first_name) completed++;
  if (userProfile.value?.last_name) completed++;
  if (userProfile.value?.avatar_url) completed++;
  
  return Math.round((completed / total) * 100);
});

// Methods
const formatDate = (date: Date) => {
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  } else {
    return date.toLocaleDateString();
  }
};

const loadUserStats = async () => {
  try {
    // Load user statistics (projects, activity, etc.)
    // This would typically come from your API
    const { projects } = useSupabaseDB();
    const projectsList = await projects.getAll();
    
    userStats.value = {
      projects: projectsList?.length || 0,
      activeProjects: projectsList?.filter((p: Project) => p.status === 'active')?.length || 0,
      lastActive: 'Today',
      storageUsed: '2.1 MB'
    };
  } catch (error) {
    console.error('Error loading user stats:', error);
  }
};

const loadRecentActivity = async () => {
  try {
    // Load recent user activity
    // This would typically come from your activity log API
    const defaultActivity = {
      icon: 'mdi-account-plus',
      title: 'Account created',
      description: 'Welcome to Cloudless.gr!',
      timestamp: user.value?.created_at ? new Date(user.value.created_at) : new Date()
    };
    
    recentActivity.value = [defaultActivity];
  } catch (error) {
    console.error('Error loading recent activity:', error);
  }
};

// Lifecycle
onMounted(async () => {
  try {
    // Load user profile if not already loaded
    if (!userProfile.value && !userProfileStore.loading) {
      await userProfileStore.loadProfile();
    }
    
    await loadUserStats();
    await loadRecentActivity();
  } catch (error) {
    console.error('Error initializing user dashboard:', error);
  }
});
</script>

<style scoped>
.users-dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.welcome-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 2rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.v-card {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
}

.v-progress-linear {
  border-radius: 4px;
}

@media (max-width: 768px) {
  .welcome-section {
    padding: 1rem;
  }
  
  .text-right {
    text-align: left !important;
  }
}
</style>
