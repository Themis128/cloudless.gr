<template>
  <v-container class="sitemap-container">
    <h1 class="text-h2 font-weight-bold text-center mb-8 text-primary">
      Sitemap
    </h1>

    <v-row>
      <v-col cols="12">
        <v-card class="mb-6">
          <v-card-title class="text-h5 text-primary">
            Main Navigation
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Home
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Welcome to Cloudless - Cloud solutions and web development
                    services
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/projects" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Projects
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Explore our portfolio of client projects and case studies
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/about" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      About Us
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Learn about our company, mission, vision, and team
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/contact" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Contact
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Get in touch with our team for inquiries and quotes
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/codegen" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Codegen
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Our code generation and AI development tools
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6">
          <v-card-title class="text-h5 text-primary">
            User Account & Dashboard
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/auth/login" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Login
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Sign in to your account
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/auth/signup" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Sign Up
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Create a new account
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink
                    to="/auth/forgot-password"
                    class="text-decoration-none"
                  >
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Forgot Password
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Reset your account password
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/dashboard" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Dashboard
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    User dashboard with activity overview
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/profile" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Profile
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Manage your user profile
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/settings" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Settings
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Configure your account preferences
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6">
          <v-card-title class="text-h5 text-primary">
            Projects & Services
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/projects" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      All Projects
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Browse our complete project portfolio
                  </p>
                </div>
              </v-col>
              <v-col
                v-for="(project, index) in featuredProjects"
                :key="index"
                cols="12"
                md="6"
                lg="4"
              >
                <div class="mb-4">
                  <NuxtLink
                    :to="`/projects/${project.slug}`"
                    class="text-decoration-none"
                  >
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      {{ project.title }}
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    {{ project.shortDescription }}
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6">
          <v-card-title class="text-h5 text-primary">
            Resources & Information
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/faq" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      FAQ
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Frequently asked questions
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/terms" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Terms & Privacy
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Terms of service and privacy policy
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/responsive-demo" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Responsive Demo
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Demo of our responsive design capabilities
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card v-if="isAdmin" class="mb-6" color="grey-lighten-4">
          <v-card-title class="text-h5 text-primary"> Admin Area </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/admin/dashboard" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Admin Dashboard
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Overview of site analytics and activity
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/admin/users" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      User Management
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Manage user accounts and permissions
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink to="/admin/projects" class="text-decoration-none">
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Project Management
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    Create and edit project listings
                  </p>
                </div>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <div class="mb-4">
                  <NuxtLink
                    to="/admin/contact-submissions"
                    class="text-decoration-none"
                  >
                    <div class="text-h6 text-primary font-weight-medium mb-1">
                      Contact Submissions
                    </div>
                  </NuxtLink>
                  <p class="text-body-2 text-medium-emphasis">
                    View and manage contact form submissions
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUserAuth } from '~/composables/useUserAuth'

interface Project {
  title: string
  slug: string
  shortDescription: string
}

const { isLoggedIn, currentUser } = useUserAuth()

const isAdmin = computed(() => {
  return currentUser.value?.role === 'admin'
})

// Featured projects - in a real app, these would be fetched from an API or database
const featuredProjects = ref<Project[]>([
  {
    title: 'E-commerce Platform',
    slug: 'e-commerce-platform',
    shortDescription:
      'A full-featured online store with product management and checkout',
  },
  {
    title: 'Health & Fitness App',
    slug: 'health-fitness-app',
    shortDescription: 'Mobile application for tracking workouts and nutrition',
  },
  {
    title: 'Corporate Website Redesign',
    slug: 'corporate-website-redesign',
    shortDescription: 'Modern redesign of a corporate website with improved UX',
  },
  {
    title: 'AI Content Generator',
    slug: 'ai-content-generator',
    shortDescription:
      'Tool that leverages machine learning to generate content',
  },
])
</script>

<style scoped>
.sitemap-container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
