<template>
  <div>
    <v-container class="about-page">
      <!-- Hero Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <h1 class="text-h2 font-weight-bold mb-4">About Cloudless Wizard</h1>
          <p class="text-h6 text-medium-emphasis">
            Empowering developers to build the future with AI-powered cloud
            development
          </p>
        </v-col>
      </v-row>

      <!-- Mission Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <v-card class="mission-card" elevation="4">
            <v-card-text class="pa-8">
              <h2 class="text-h3 font-weight-bold mb-6 text-center">
                Our Mission
              </h2>

              <p class="text-body-1 text-medium-emphasis mb-8 text-center">
                At Cloudless Wizard, we believe that the future of software
                development lies in the seamless integration of artificial
                intelligence and cloud computing. Our mission is to democratize
                AI development by providing developers with intuitive, powerful
                tools that make building intelligent applications accessible to
                everyone.
              </p>

              <!-- Stats Grid -->
              <v-row>
                <v-col
                  v-for="stat in missionStats"
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

      <!-- Story Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <v-card class="story-card" elevation="4">
            <v-card-text class="pa-8">
              <h2 class="text-h3 font-weight-bold mb-6 text-center">
                Our Story
              </h2>

              <v-row align="center">
                <v-col cols="12" lg="8">
                  <div class="story-content">
                    <p class="text-body-1 text-medium-emphasis mb-4">
                      Founded in 2023 by a team of experienced developers and AI
                      researchers, Cloudless Wizard was born from a simple
                      observation: while AI technology was advancing rapidly,
                      the tools for building AI applications remained complex
                      and inaccessible to most developers.
                    </p>
                    <p class="text-body-1 text-medium-emphasis mb-4">
                      We set out to change that by creating a platform that
                      combines the power of modern AI with the simplicity and
                      reliability that developers expect. Today, Cloudless
                      Wizard serves thousands of developers worldwide, helping
                      them build, train, and deploy intelligent applications
                      faster than ever before.
                    </p>
                    <p class="text-body-1 text-medium-emphasis">
                      Our platform has evolved from a simple model training tool
                      into a comprehensive AI development ecosystem, supporting
                      everything from data preprocessing to production
                      deployment. We continue to innovate and expand our
                      capabilities based on the needs and feedback of our
                      growing community.
                    </p>
                  </div>
                </v-col>

                <v-col cols="12" lg="4" class="text-center">
                  <div class="story-image">
                    <v-icon size="120" color="primary"
                      >mdi-rocket-launch</v-icon
                    >
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Values Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <div class="text-center mb-8">
            <h2 class="text-h3 font-weight-bold mb-4">Our Values</h2>
            <p class="text-h6 text-medium-emphasis">
              The principles that guide everything we do
            </p>
          </div>

          <v-row>
            <v-col
              v-for="value in values"
              :key="value.id"
              cols="12"
              md="6"
              lg="3"
            >
              <ValueCard :value="value" />
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- Team Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <v-card class="team-card" elevation="4">
            <v-card-text class="pa-8">
              <h2 class="text-h3 font-weight-bold mb-6 text-center">
                Our Team
              </h2>

              <p class="text-body-1 text-medium-emphasis mb-8 text-center">
                Meet the passionate individuals behind Cloudless Wizard
              </p>

              <v-row>
                <v-col
                  v-for="member in teamMembers"
                  :key="member.id"
                  cols="12"
                  sm="6"
                  md="4"
                  lg="3"
                >
                  <TeamMemberCard :member="member" />
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
                Join Our Mission
              </h2>
              <p class="text-h6 text-white mb-6">
                Be part of the future of AI development
              </p>
              <div class="d-flex flex-wrap justify-center">
                <v-btn
                  color="white"
                  variant="outlined"
                  size="large"
                  class="mr-4"
                  to="/contact"
                  :ripple="false"
                >
                  <v-icon start>mdi-email</v-icon>
                  Get in Touch
                </v-btn>
                <v-btn color="white" size="large" to="/careers" :ripple="false">
                  <v-icon start>mdi-briefcase</v-icon>
                  Join Our Team
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

// Types
interface Stat {
  id: string
  value: string
  label: string
  icon: string
}

interface Value {
  id: string
  title: string
  description: string
  icon: string
  color: string
}

interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
  bio: string
}

// Composables
const router = useRouter()
const notificationsStore = useNotificationsStore()

// Data
const missionStats: Stat[] = [
  {
    id: 'developers',
    value: '10,000+',
    label: 'Developers',
    icon: 'mdi-account-group',
  },
  {
    id: 'models',
    value: '50,000+',
    label: 'Models Deployed',
    icon: 'mdi-brain',
  },
  {
    id: 'uptime',
    value: '99.9%',
    label: 'Uptime',
    icon: 'mdi-server',
  },
  {
    id: 'support',
    value: '24/7',
    label: 'Support',
    icon: 'mdi-headset',
  },
]

const values: Value[] = [
  {
    id: 'innovation',
    title: 'Innovation',
    description:
      "We constantly push the boundaries of what's possible in AI development, always looking for new ways to make technology more accessible and powerful.",
    icon: 'mdi-lightbulb',
    color: 'primary',
  },
  {
    id: 'community',
    title: 'Community',
    description:
      "We believe in the power of collaboration and knowledge sharing. Our community of developers drives our product development and supports each other's growth.",
    icon: 'mdi-account-group',
    color: 'success',
  },
  {
    id: 'trust',
    title: 'Trust & Security',
    description:
      "We prioritize the security and privacy of our users' data and models. Trust is the foundation of everything we do.",
    icon: 'mdi-shield-check',
    color: 'warning',
  },
  {
    id: 'education',
    title: 'Education',
    description:
      "We're committed to helping developers learn and grow. Our platform includes comprehensive documentation, tutorials, and learning resources.",
    icon: 'mdi-school',
    color: 'info',
  },
]

const teamMembers: TeamMember[] = [
  {
    id: 'ceo',
    name: 'Alex Johnson',
    role: 'CEO & Co-Founder',
    avatar: '/avatars/alex.jpg',
    bio: 'Former AI researcher with 15+ years in machine learning and cloud infrastructure.',
  },
  {
    id: 'cto',
    name: 'Sarah Chen',
    role: 'CTO & Co-Founder',
    avatar: '/avatars/sarah.jpg',
    bio: 'Expert in distributed systems and AI model deployment with experience at major tech companies.',
  },
  {
    id: 'head-engineering',
    name: 'Michael Rodriguez',
    role: 'Head of Engineering',
    avatar: '/avatars/michael.jpg',
    bio: 'Full-stack developer passionate about making AI accessible to developers of all skill levels.',
  },
  {
    id: 'head-product',
    name: 'Emily Watson',
    role: 'Head of Product',
    avatar: '/avatars/emily.jpg',
    bio: 'Product strategist focused on user experience and developer productivity tools.',
  },
]

// Methods
const handleContactClick = () => {
  try {
    router.push('/contact')
    notificationsStore.info('Contact', 'Navigating to contact page')
  } catch (error) {
    notificationsStore.error('Error', 'Failed to navigate to contact page')
  }
}

// Meta
definePageMeta({
  title: 'About Cloudless Wizard - AI-Powered Development Platform',
  description:
    "Learn about Cloudless Wizard's mission to democratize AI development and empower developers to build the future with our innovative platform.",
  layout: 'default',
})
</script>

<style scoped>
.about-page {
  max-width: 1200px;
  margin: 0 auto;
}

.mission-card,
.story-card,
.team-card {
  border-radius: 16px;
  transition: all 0.3s ease-in-out;
}

.mission-card:hover,
.story-card:hover,
.team-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.story-image {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.cta-card {
  background: linear-gradient(
    135deg,
    var(--v-theme-primary) 0%,
    var(--v-theme-secondary) 100%
  );
  border-radius: 16px;
}

/* Responsive improvements */
@media (max-width: 600px) {
  .about-page {
    padding: 0 16px;
  }

  .story-image {
    min-height: 150px;
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
</style>
