<template>
  <div>
    <v-container>
      <h1 class="text-h3 mb-6">Navigation Test Page</h1>

      <v-alert type="info" class="mb-6">
        This page tests navigation functionality. All links below should work
        properly.
      </v-alert>

      <v-row>
        <v-col cols="12" md="6">
          <v-card class="mb-4">
            <v-card-title>Public Pages</v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item to="/" prepend-icon="mdi-home"> Home </v-list-item>
                <v-list-item to="/about" prepend-icon="mdi-information">
                  About
                </v-list-item>
                <v-list-item to="/contact" prepend-icon="mdi-email">
                  Contact
                </v-list-item>
                <v-list-item to="/privacy" prepend-icon="mdi-shield">
                  Privacy
                </v-list-item>
                <v-list-item to="/terms" prepend-icon="mdi-file-document">
                  Terms
                </v-list-item>
                <v-list-item to="/faq" prepend-icon="mdi-help-circle">
                  FAQ
                </v-list-item>
                <v-list-item to="/pricing" prepend-icon="mdi-currency-usd">
                  Pricing
                </v-list-item>
                <v-list-item to="/support" prepend-icon="mdi-lifebuoy">
                  Support
                </v-list-item>
                <v-list-item to="/blog" prepend-icon="mdi-post">
                  Blog
                </v-list-item>
                <v-list-item to="/community" prepend-icon="mdi-account-group">
                  Community
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card class="mb-4">
            <v-card-title>App Pages</v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item to="/projects" prepend-icon="mdi-folder-multiple">
                  Projects
                </v-list-item>
                <v-list-item to="/bots" prepend-icon="mdi-robot">
                  Bots
                </v-list-item>
                <v-list-item to="/models" prepend-icon="mdi-brain">
                  Models
                </v-list-item>
                <v-list-item to="/pipelines" prepend-icon="mdi-timeline">
                  Pipelines
                </v-list-item>
                <v-list-item to="/llm" prepend-icon="mdi-brain">
                  LLM Overview
                </v-list-item>
                <v-list-item to="/dashboard" prepend-icon="mdi-view-dashboard">
                  Dashboard
                </v-list-item>
                <v-list-item to="/debug" prepend-icon="mdi-bug">
                  Debug
                </v-list-item>
                <v-list-item to="/deploy" prepend-icon="mdi-rocket-launch">
                  Deploy
                </v-list-item>
                <v-list-item
                  to="/documentation"
                  prepend-icon="mdi-book-open-variant"
                >
                  Documentation
                </v-list-item>
                <v-list-item to="/api-reference" prepend-icon="mdi-api">
                  API Reference
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title>Navigation Status</v-card-title>
            <v-card-text>
              <v-alert
                :type="isAuthenticated ? 'success' : 'info'"
                class="mb-4"
              >
                Authentication Status:
                {{ isAuthenticated ? 'Authenticated' : 'Not Authenticated' }}
              </v-alert>

              <v-alert :type="isAdmin ? 'warning' : 'info'" class="mb-4">
                Admin Status: {{ isAdmin ? 'Admin User' : 'Regular User' }}
              </v-alert>

              <v-btn color="primary" @click="testNavigation" class="mr-4">
                Test Navigation
              </v-btn>

              <v-btn color="secondary" @click="goBack"> Go Back </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

// Get auth state
const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)

const testNavigation = () => {
  // Test navigation to different pages
  const testPages = ['/', '/about', '/contact', '/projects', '/bots']
  const randomPage = testPages[Math.floor(Math.random() * testPages.length)]

  router.push(randomPage)
}

const goBack = () => {
  router.back()
}
</script>
