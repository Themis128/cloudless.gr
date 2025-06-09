<template>
  <v-container fluid class="pa-4" style="max-width: 1200px; margin: 0 auto">
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <v-card class="pa-6" elevation="2" rounded="lg">
          <div class="d-flex flex-wrap justify-space-between align-center">
            <div>
              <h1 class="text-h3 font-weight-bold text-primary mb-2">Dashboard</h1>
              <p class="text-subtitle-1 text-grey-darken-1">
                Welcome back, {{ currentUser?.name || 'User' }}!
              </p>
            </div>
            <v-chip color="primary" variant="elevated" size="large" prepend-icon="mdi-account">
              User Account
            </v-chip>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dashboard Cards -->
    <v-row class="mb-6">
      <!-- Activity Stats -->
      <v-col cols="12" md="6" lg="3">
        <v-card height="100%" elevation="3" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold text-primary">
            <v-icon start color="primary" class="mr-2">mdi-chart-timeline-variant</v-icon>
            Your Activity
          </v-card-title>
          <v-card-text>
            <v-row class="text-center">
              <v-col cols="4">
                <div class="text-h4 font-weight-bold text-primary">
                  {{ userStats.projectsViewed }}
                </div>
                <div class="text-caption text-grey-darken-1">Projects Viewed</div>
              </v-col>
              <v-col cols="4">
                <div class="text-h4 font-weight-bold text-primary">{{ userStats.comments }}</div>
                <div class="text-caption text-grey-darken-1">Comments</div>
              </v-col>
              <v-col cols="4">
                <div class="text-h4 font-weight-bold text-primary">{{ userStats.likes }}</div>
                <div class="text-caption text-grey-darken-1">Likes</div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Recent Updates -->
      <v-col cols="12" md="6" lg="3">
        <v-card height="100%" elevation="3" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold text-primary">
            <v-icon start color="primary" class="mr-2">mdi-bell</v-icon>
            Recent Updates
          </v-card-title>
          <v-card-text>
            <v-list v-if="recentUpdates.length > 0" density="compact">
              <v-list-item
                v-for="update in recentUpdates"
                :key="update.id"
                :title="update.title"
                :subtitle="update.date"
                class="px-0"
              >
                <template v-slot:prepend>
                  <v-avatar size="small" :color="update.type === 'info' ? 'primary' : 'success'">
                    <v-icon size="small">{{ update.icon }}</v-icon>
                  </v-avatar>
                </template>
              </v-list-item>
            </v-list>
            <v-alert v-else variant="tonal" type="info" class="mb-0">
              No updates to display yet.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Favorites -->
      <v-col cols="12" md="6" lg="3">
        <v-card height="100%" elevation="3" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold text-primary">
            <v-icon start color="primary" class="mr-2">mdi-heart</v-icon>
            Your Favorites
          </v-card-title>
          <v-card-text>
            <v-list v-if="favorites.length > 0" density="compact">
              <v-list-item
                v-for="favorite in favorites"
                :key="favorite.id"
                :title="favorite.name"
                :subtitle="favorite.type"
                :to="favorite.link"
                class="px-0"
              >
                <template v-slot:prepend>
                  <v-avatar size="small" color="error">
                    <v-icon size="small">mdi-heart</v-icon>
                  </v-avatar>
                </template>
              </v-list-item>
            </v-list>
            <v-alert v-else variant="tonal" type="info" class="mb-0">
              You haven't saved any favorites yet.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Quick Actions -->
      <v-col cols="12" md="6" lg="3">
        <v-card height="100%" elevation="3" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold text-primary">
            <v-icon start color="primary" class="mr-2">mdi-flash</v-icon>
            Quick Actions
          </v-card-title>
          <v-card-text class="d-flex flex-column ga-3">
            <v-btn
              to="/profile"
              prepend-icon="mdi-account-edit"
              variant="outlined"
              color="primary"
              block
              size="large"
            >
              Edit Profile
            </v-btn>
            <v-btn
              to="/projects"
              prepend-icon="mdi-folder-multiple"
              variant="outlined"
              color="primary"
              block
              size="large"
            >
              Browse Projects
            </v-btn>
            <v-btn
              to="/contact"
              prepend-icon="mdi-message-text"
              variant="outlined"
              color="primary"
              block
              size="large"
            >
              Contact Support
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Additional Dashboard Sections -->
    <v-row>
      <!-- Recent Projects -->
      <v-col cols="12" md="8">
        <v-card elevation="3" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold text-primary">
            <v-icon start color="primary" class="mr-2">mdi-folder-open</v-icon>
            Recent Projects
          </v-card-title>
          <v-card-text>
            <v-list v-if="recentProjects.length > 0">
              <v-list-item
                v-for="project in recentProjects"
                :key="project.id"
                :title="project.title"
                :subtitle="project.description"
                :to="`/projects/${project.slug}`"
              >
                <template v-slot:prepend>
                  <v-avatar color="primary" class="mr-3">
                    <v-icon>{{ project.icon || 'mdi-folder' }}</v-icon>
                  </v-avatar>
                </template>
                <template v-slot:append>
                  <v-chip size="small" variant="outlined">{{ project.status }}</v-chip>
                </template>
              </v-list-item>
            </v-list>
            <v-alert v-else variant="tonal" type="info" class="mb-0">
              No recent projects to display.
              <nuxt-link to="/projects">Browse all projects</nuxt-link>
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Account Summary -->
      <v-col cols="12" md="4">
        <v-card elevation="3" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold text-primary">
            <v-icon start color="primary" class="mr-2">mdi-account-circle</v-icon>
            Account Summary
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title>Member Since</v-list-item-title>
                <v-list-item-subtitle>{{
                  formatDate(currentUser?.createdAt)
                }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Account Status</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip color="success" size="small">Active</v-chip>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Email</v-list-item-title>
                <v-list-item-subtitle>{{
                  currentUser?.email || 'Not provided'
                }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue';
  import { useUserAuth } from '~/composables/useUserAuth';
  import { useDateFormatting } from '~/composables/useDateFormatting';

  // Use the authentication composable
  const { currentUser, isLoggedIn } = useUserAuth();
  const { formatDate } = useDateFormatting();

  // Define interfaces for type safety
  interface UserStats {
    projectsViewed: number;
    comments: number;
    likes: number;
  }

  interface Update {
    id: number;
    title: string;
    date: string;
    type: 'info' | 'success' | 'warning' | 'error';
    icon: string;
  }

  interface Favorite {
    id: number;
    name: string;
    type: string;
    link: string;
  }

  interface Project {
    id: number;
    title: string;
    description: string;
    slug: string;
    status: string;
    icon?: string;
  }

  // Reactive data with proper typing
  const userStats = ref<UserStats>({
    projectsViewed: 5,
    comments: 12,
    likes: 8,
  });

  const recentUpdates = ref<Update[]>([
    {
      id: 1,
      title: 'Welcome to your dashboard!',
      date: formatDate(new Date()),
      type: 'info',
      icon: 'mdi-information',
    },
    {
      id: 2,
      title: 'Your profile has been updated',
      date: formatDate(new Date(Date.now() - 86400000)), // Yesterday
      type: 'success',
      icon: 'mdi-check-circle',
    },
  ]);

  const favorites = ref<Favorite[]>([
    {
      id: 1,
      name: 'Cloudless Portfolio',
      type: 'Project',
      link: '/projects/cloudless-portfolio',
    },
    {
      id: 2,
      name: 'Vue.js Components',
      type: 'Collection',
      link: '/projects/vue-components',
    },
  ]);

  const recentProjects = ref<Project[]>([
    {
      id: 1,
      title: 'Personal Portfolio Website',
      description: 'A modern portfolio built with Nuxt.js and Vuetify',
      slug: 'portfolio-website',
      status: 'Active',
      icon: 'mdi-web',
    },
    {
      id: 2,
      title: 'E-commerce Platform',
      description: 'Full-stack e-commerce solution',
      slug: 'ecommerce-platform',
      status: 'In Progress',
      icon: 'mdi-shopping',
    },
    {
      id: 3,
      title: 'Task Management App',
      description: 'Collaborative task management tool',
      slug: 'task-management',
      status: 'Complete',
      icon: 'mdi-check-all',
    },
  ]);

  const isUserDataLoaded = ref(false);

  // Methods
  const loadUserData = async () => {
    try {
      isUserDataLoaded.value = false;

      // In a real app, these would be API calls
      // For now, we'll simulate loading with mock data

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Load user stats from localStorage or use defaults
      const savedStats = localStorage.getItem('userStats');
      if (savedStats) {
        try {
          userStats.value = { ...userStats.value, ...JSON.parse(savedStats) };
        } catch {
          console.warn('Could not parse saved user stats');
        }
      }

      isUserDataLoaded.value = true;
    } catch (error) {
      console.error('Error loading user data:', error);
      isUserDataLoaded.value = true; // Still mark as loaded to show default data
    }
  };

  // Save user stats to localStorage when they change
  const saveUserStats = () => {
    try {
      localStorage.setItem('userStats', JSON.stringify(userStats.value));
    } catch {
      console.warn('Could not save user stats to localStorage');
    }
  };

  // Lifecycle hooks
  onMounted(async () => {
    if (isLoggedIn.value) {
      await loadUserData();
    } else {
      // If not logged in, redirect to login
      await navigateTo('/auth/login');
    }
  });

  // Watch for changes in user stats and save them
  watch(userStats, saveUserStats, { deep: true });

  // Authentication middleware
  definePageMeta({
    layout: 'default',
    middleware: ['user-auth'],
  });

  // SEO
  useHead({
    title: 'Dashboard - Cloudless.gr',
    meta: [
      {
        name: 'description',
        content:
          'Your personal dashboard on Cloudless.gr - view your activity, projects, and favorites',
      },
      {
        name: 'keywords',
        content: 'dashboard, user dashboard, projects, cloudless',
      },
    ],
  });
</script>

<style scoped>
  /* Minimal scoped styles - let Vuetify handle most styling */
  .v-container {
    min-height: calc(100vh - 200px);
  }

  /* Ensure proper spacing on mobile */
  @media (max-width: 600px) {
    .v-container {
      padding: 1rem !important;
    }
  }
</style>
