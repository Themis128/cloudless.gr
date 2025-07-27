<template>
  <div>
    <v-container fluid class="hero-section pa-0">
      <!-- Hero Section -->
      <v-row justify="center" align="center" class="hero-content">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <h1 class="text-h2 font-weight-bold mb-4 text-white">
            Welcome to Cloudless
          </h1>
          <p class="text-h6 text-white mb-8">
            Your all-in-one low-code platform for data pipelines, analytics, and
            AI.
          </p>

          <div class="d-flex flex-wrap justify-center">
            <v-btn
              color="white"
              variant="outlined"
              size="large"
              class="hero-btn mr-4"
              to="/projects"
              :ripple="false"
            >
              <v-icon start>mdi-folder-multiple</v-icon>
              Explore Projects
            </v-btn>
            <v-btn
              color="primary"
              size="large"
              class="hero-btn-primary"
              to="/contact"
              :ripple="false"
            >
              <v-icon start>mdi-rocket-launch</v-icon>
              Get Started
            </v-btn>
          </div>
        </v-col>
      </v-row>
    </v-container>

    <v-container class="main-content">
      <!-- Platform Overview Card -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" lg="10">
          <v-card class="platform-card" elevation="8" rounded="xl">
            <v-card-text class="pa-8">
              <div class="text-center mb-8">
                <v-icon size="64" color="primary" class="mb-4">
                  mdi-cloud-outline
                </v-icon>
                <h2 class="text-h3 font-weight-bold mb-4">
                  Cloudless Platform
                </h2>
                <p class="text-h6 text-medium-emphasis mb-6">
                  Experience the future of low-code development with our
                  advanced AI-powered platform. Build, deploy, and scale your
                  applications with unprecedented ease.
                </p>
              </div>

              <v-divider class="my-6" />

              <!-- Quick Actions Grid -->
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-6">
                    <h3
                      class="text-h5 font-weight-bold mb-4 d-flex align-center"
                    >
                      <v-icon color="primary" class="mr-2"
                        >mdi-lightning-bolt</v-icon
                      >
                      Quick Actions
                    </h3>
                    <div class="d-flex flex-column">
                      <v-btn
                        variant="text"
                        class="action-btn justify-start mb-3"
                        to="/projects"
                        :ripple="false"
                      >
                        <v-icon start color="primary"
                          >mdi-folder-multiple</v-icon
                        >
                        <span>Browse Projects</span>
                      </v-btn>
                      <v-btn
                        variant="text"
                        class="action-btn justify-start mb-3"
                        to="/contact"
                        :ripple="false"
                      >
                        <v-icon start color="primary">mdi-email</v-icon>
                        <span>Contact Support</span>
                      </v-btn>
                      <v-btn
                        variant="text"
                        class="action-btn justify-start mb-3"
                        to="/profile"
                        :ripple="false"
                      >
                        <v-icon start color="primary">mdi-cog</v-icon>
                        <span>Settings</span>
                      </v-btn>
                      <v-btn
                        variant="text"
                        class="action-btn justify-start"
                        to="/dashboard"
                        :ripple="false"
                      >
                        <v-icon start color="primary"
                          >mdi-view-dashboard</v-icon
                        >
                        <span>Dashboard</span>
                      </v-btn>
                    </div>
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="mb-6">
                    <h3
                      class="text-h5 font-weight-bold mb-4 d-flex align-center"
                    >
                      <v-icon color="success" class="mr-2"
                        >mdi-chart-line</v-icon
                      >
                      Platform Features
                    </h3>
                    <div class="d-flex flex-column">
                      <div class="d-flex align-center mb-3">
                        <v-icon color="success" size="20" class="mr-3"
                          >mdi-check-circle</v-icon
                        >
                        <span>AI-Powered Development</span>
                      </div>
                      <div class="d-flex align-center mb-3">
                        <v-icon color="success" size="20" class="mr-3"
                          >mdi-check-circle</v-icon
                        >
                        <span>Low-Code Interface</span>
                      </div>
                      <div class="d-flex align-center mb-3">
                        <v-icon color="success" size="20" class="mr-3"
                          >mdi-check-circle</v-icon
                        >
                        <span>Real-time Analytics</span>
                      </div>
                      <div class="d-flex align-center">
                        <v-icon color="success" size="20" class="mr-3"
                          >mdi-check-circle</v-icon
                        >
                        <span>Scalable Infrastructure</span>
                      </div>
                    </div>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Features Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <div class="text-center mb-8">
            <h2 class="text-h3 font-weight-bold mb-4">Platform Features</h2>
            <p class="text-h6 text-medium-emphasis">
              Everything you need to build, deploy, and scale AI applications
            </p>
          </div>

          <v-row>
            <v-col
              v-for="feature in features"
              :key="feature.id"
              cols="12"
              md="6"
              lg="4"
            >
              <FeatureCard :feature="feature" />
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- Stats Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <v-card class="stats-card" elevation="4">
            <v-card-text class="pa-8">
              <v-row>
                <v-col
                  v-for="stat in stats"
                  :key="stat.id"
                  cols="12"
                  sm="6"
                  md="3"
                  class="text-center"
                >
                  <StatCard :stat="stat" />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- CTA Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <v-card class="cta-card" elevation="8" color="primary">
            <v-card-text class="pa-8">
              <h2 class="text-h3 font-weight-bold mb-4 text-white">
                Ready to Get Started?
              </h2>
              <p class="text-h6 text-white mb-6">
                Join thousands of developers building the future with Cloudless
              </p>
              <div class="d-flex flex-wrap justify-center">
                <v-btn
                  color="white"
                  variant="outlined"
                  size="large"
                  class="mr-4"
                  to="/register"
                  :ripple="false"
                >
                  <v-icon start>mdi-account-plus</v-icon>
                  Sign Up Free
                </v-btn>
                <v-btn color="white" size="large" to="/contact" :ripple="false">
                  <v-icon start>mdi-phone</v-icon>
                  Contact Sales
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { useNotificationsStore } from '@/stores/useNotificationsStore'
import { useRouter } from 'vue-router'
import FeatureCard from '~/components/ui/FeatureCard.vue'
import StatCard from '~/components/ui/StatCard.vue'

// Types
interface Feature {
  id: string
  title: string
  description: string
  icon: string
  color: string
}

interface Stat {
  id: string
  value: string
  label: string
  icon: string
}

// Composables
const router = useRouter()
const notificationsStore = useNotificationsStore()

// Data
const features: Feature[] = [
  {
    id: 'ai-development',
    title: 'AI Development',
    description:
      'Build intelligent applications with our advanced AI tools and pre-trained models',
    icon: 'mdi-brain',
    color: 'primary',
  },
  {
    id: 'data-pipelines',
    title: 'Data Pipelines',
    description:
      'Create scalable data processing workflows with our visual pipeline builder',
    icon: 'mdi-timeline',
    color: 'success',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description:
      'Get real-time insights with our comprehensive analytics and monitoring tools',
    icon: 'mdi-chart-line',
    color: 'info',
  },
  {
    id: 'deployment',
    title: 'Deployment',
    description:
      'Deploy your applications with one click to our managed cloud infrastructure',
    icon: 'mdi-rocket-launch',
    color: 'warning',
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together with your team using our built-in collaboration features',
    icon: 'mdi-account-group',
    color: 'error',
  },
  {
    id: 'security',
    title: 'Security',
    description:
      'Enterprise-grade security with SOC 2 compliance and advanced encryption',
    icon: 'mdi-shield-check',
    color: 'secondary',
  },
]

const stats: Stat[] = [
  {
    id: 'developers',
    value: '10,000+',
    label: 'Active Developers',
    icon: 'mdi-account-group',
  },
  {
    id: 'projects',
    value: '50,000+',
    label: 'Projects Created',
    icon: 'mdi-folder-multiple',
  },
  {
    id: 'uptime',
    value: '99.9%',
    label: 'Platform Uptime',
    icon: 'mdi-server',
  },
  {
    id: 'countries',
    value: '150+',
    label: 'Countries Served',
    icon: 'mdi-earth',
  },
]

// Methods
const handleFeatureClick = (feature: Feature) => {
  try {
    router.push(`/features/${feature.id}`)
    notificationsStore.info('Feature', `Learn more about ${feature.title}`)
  } catch (error) {
    notificationsStore.error('Error', 'Failed to navigate to feature page')
  }
}

// Meta
definePageMeta({
  title: 'Cloudless - AI-Powered Low-Code Platform',
  description:
    'Build, deploy, and scale AI applications with our advanced low-code platform. Experience the future of development with Cloudless.',
  layout: 'default',
})
</script>

<style scoped>
.hero-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 60vh;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-btn {
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.hero-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.hero-btn-primary {
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.hero-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.platform-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-btn {
  transition: all 0.2s ease;
  border-radius: 8px;
  padding: 12px 16px;
}

.action-btn:hover {
  background: rgba(var(--v-theme-primary), 0.1);
  transform: translateX(4px);
}

.stats-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.cta-card {
  background: linear-gradient(
    135deg,
    var(--v-theme-primary) 0%,
    var(--v-theme-secondary) 100%
  );
}

/* Responsive improvements */
@media (max-width: 600px) {
  .hero-section {
    min-height: 50vh;
  }

  .hero-content {
    padding: 2rem 1rem;
  }
}

/* Accessibility improvements */
:focus-visible {
  outline: 2px solid var(--v-theme-primary);
  outline-offset: 2px;
}

/* Smooth transitions */
.v-card {
  transition: all 0.3s ease-in-out;
}

.v-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}
</style>
