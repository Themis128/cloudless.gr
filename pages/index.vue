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
  <v-container fluid class="home-container">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <!-- Welcome Hero Section -->
        <v-card class="glassmorphism-card mb-6 text-center" elevation="0">
          <v-card-text class="pa-8">
            <div class="welcome-section">
              <v-avatar size="80" class="mb-4">
                <v-icon size="48" color="primary">mdi-cloud-outline</v-icon>
              </v-avatar>
              <h1 class="text-h3 font-weight-bold text-primary mb-4">
                Welcome to Cloudless.gr
              </h1>
              <p class="text-h6 text-medium-emphasis mb-6">
                {{ user ? `Hello, ${user.email}!` : 'Your AI-powered development platform' }}
              </p>
              
              <v-row v-if="!user" class="mb-4" justify="center">
                <v-col cols="auto">
                  <v-btn
                    color="primary"
                    size="large"
                    to="/auth/login"
                    prepend-icon="mdi-login"
                    class="glassmorphism-btn"
                  >
                    Sign In
                  </v-btn>
                </v-col>
                <v-col cols="auto">
                  <v-btn
                    variant="outlined"
                    color="primary"
                    size="large"
                    to="/auth/signup"
                    prepend-icon="mdi-account-plus"
                    class="glassmorphism-btn"
                  >
                    Get Started
                  </v-btn>
                </v-col>
              </v-row>
            </div>
          </v-card-text>
        </v-card>

        <!-- Quick Actions for Authenticated Users -->
        <v-row v-if="user" class="mb-6">
          <v-col cols="12" sm="6" md="3">
            <v-card
              class="glassmorphism-card quick-action-card"
              elevation="0"
              to="/dashboard"
              hover
            >
              <v-card-text class="text-center pa-6">
                <v-icon size="48" color="primary" class="mb-3">mdi-view-dashboard</v-icon>
                <h3 class="text-h6 font-weight-medium">Dashboard</h3>
                <p class="text-body-2 text-medium-emphasis">View your overview</p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" sm="6" md="3">
            <v-card
              class="glassmorphism-card quick-action-card"
              elevation="0"
              to="/projects"
              hover
            >
              <v-card-text class="text-center pa-6">
                <v-icon size="48" color="primary" class="mb-3">mdi-folder-multiple</v-icon>
                <h3 class="text-h6 font-weight-medium">Projects</h3>
                <p class="text-body-2 text-medium-emphasis">Manage your work</p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" sm="6" md="3">
            <v-card
              class="glassmorphism-card quick-action-card"
              elevation="0"
              to="/builder"
              hover
            >
              <v-card-text class="text-center pa-6">
                <v-icon size="48" color="primary" class="mb-3">mdi-cube-outline</v-icon>
                <h3 class="text-h6 font-weight-medium">Builder</h3>
                <p class="text-body-2 text-medium-emphasis">Create AI agents</p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" sm="6" md="3">
            <v-card
              class="glassmorphism-card quick-action-card"
              elevation="0"
              to="/workflows"
              hover
            >
              <v-card-text class="text-center pa-6">
                <v-icon size="48" color="primary" class="mb-3">mdi-graph-outline</v-icon>
                <h3 class="text-h6 font-weight-medium">Workflows</h3>
                <p class="text-body-2 text-medium-emphasis">Automate tasks</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Features Section -->
        <v-row class="mb-6">
          <v-col cols="12" md="4">
            <v-card class="glassmorphism-card h-100" elevation="0">
              <v-card-text class="pa-6 text-center">
                <v-icon size="56" color="success" class="mb-4">mdi-robot-excited</v-icon>
                <h3 class="text-h6 font-weight-medium mb-3">AI-Powered Agents</h3>
                <p class="text-body-2">
                  Build intelligent agents that can understand, reason, and act on your behalf.
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card class="glassmorphism-card h-100" elevation="0">
              <v-card-text class="pa-6 text-center">
                <v-icon size="56" color="warning" class="mb-4">mdi-workflow</v-icon>
                <h3 class="text-h6 font-weight-medium mb-3">Smart Workflows</h3>
                <p class="text-body-2">
                  Create automated workflows that connect your tools and streamline your processes.
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card class="glassmorphism-card h-100" elevation="0">
              <v-card-text class="pa-6 text-center">
                <v-icon size="56" color="info" class="mb-4">mdi-cloud-check</v-icon>
                <h3 class="text-h6 font-weight-medium mb-3">Cloud Native</h3>
                <p class="text-body-2">
                  Serverless architecture ensures scalability, reliability, and cost-effectiveness.
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Recent Activity for Authenticated Users -->
        <v-row v-if="user">
          <v-col cols="12" md="6">
            <DashboardStats />
          </v-col>
          <v-col cols="12" md="6">
            <RecentActivity />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// ✅ Public page - accessible without authentication
definePageMeta({
  public: true
})

const user = useSupabaseUser()

// Only import these components if user is authenticated
const DashboardStats = user.value ? await import('~/components/dashboard/DashboardStats.vue').catch(() => null) : null
const RecentActivity = user.value ? await import('~/components/dashboard/RecentActivity.vue').catch(() => null) : null
</script>

<style scoped>
.home-container {
  min-height: 80vh;
  padding-top: 2rem;
}

.glassmorphism-card {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.glassmorphism-card:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.glassmorphism-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glassmorphism-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

.quick-action-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.quick-action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
}

.welcome-section {
  max-width: 600px;
  margin: 0 auto;
}

/* Ensure text is readable against the clouds background */
.v-card-text h1,
.v-card-text h3,
.v-card-text p {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Mobile optimizations */
@media (max-width: 599px) {
  .home-container {
    padding-top: 1rem;
  }
  
  .welcome-section h1 {
    font-size: 2rem !important;
  }
  
  .quick-action-card {
    margin-bottom: 1rem;
  }
}

/* Animation for cards on load */
.glassmorphism-card {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Stagger animation for multiple cards */
.quick-action-card:nth-child(1) { animation-delay: 0.1s; }
.quick-action-card:nth-child(2) { animation-delay: 0.2s; }
.quick-action-card:nth-child(3) { animation-delay: 0.3s; }
.quick-action-card:nth-child(4) { animation-delay: 0.4s; }
</style>
