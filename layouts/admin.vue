<template>
  <NuxtLayout name="default">
    <v-container fluid class="pa-0">
      <!-- Admin Toolbar -->
      <v-card
        class="mb-6 mx-4 mt-4"
        color="primary"
        variant="elevated"
        style="backdrop-filter: blur(10px)"
      >
        <v-card-text class="py-4">
          <v-row align="center" justify="space-between" no-gutters>
            <v-col cols="auto">
              <v-card-title class="text-h5 font-weight-bold text-white pa-0">
                <v-icon start color="white" class="mr-2"
                  >mdi-shield-crown</v-icon
                >
                Admin Dashboard
              </v-card-title>
            </v-col>

            <v-col cols="auto">
              <v-row align="center" no-gutters>
                <v-btn
                  to="/admin/dashboard"
                  variant="text"
                  color="white"
                  prepend-icon="mdi-view-dashboard"
                  class="mr-2"
                >
                  Dashboard
                </v-btn>
                <v-btn
                  to="/admin/users"
                  variant="text"
                  color="white"
                  prepend-icon="mdi-account-group"
                  class="mr-2"
                >
                  Users
                </v-btn>
                <v-btn
                  to="/admin/projects"
                  variant="text"
                  color="white"
                  prepend-icon="mdi-folder-multiple"
                  class="mr-2"
                >
                  Projects
                </v-btn>
                <v-btn
                  to="/admin/contact-submissions"
                  variant="text"
                  color="white"
                  prepend-icon="mdi-message-text"
                  class="mr-4"
                >
                  Contact Submissions
                </v-btn>
                <v-btn
                  color="error"
                  variant="outlined"
                  prepend-icon="mdi-logout"
                  @click="handleLogout"
                  :loading="authLoading"
                >
                  Logout
                </v-btn>
              </v-row>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Admin Content -->
      <v-container class="admin-content">
        <slot />
      </v-container>

      <!-- Admin Footer -->
      <v-footer class="admin-footer">
        <v-container>
          <v-row justify="center" align="center">
            <v-col cols="auto">
              <v-chip
                color="primary"
                variant="outlined"
                prepend-icon="mdi-shield-check"
                size="small"
              >
                Admin area - For authorized users only
              </v-chip>
            </v-col>
          </v-row>
        </v-container>
      </v-footer>
    </v-container>
  </NuxtLayout>
</template>

<script setup lang="ts">
// Authentication state - client-side only to prevent hydration mismatches
const authLoading = ref(false)

// Logout function
const handleLogout = async (): Promise<void> => {
  try {
    authLoading.value = true
    const authStore = useAuthStore()
    await authStore.logout()
    await navigateTo('/auth/login')
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    authLoading.value = false
  }
}
</script>

<style scoped>
.admin-content {
  min-height: calc(100vh - 300px);
  position: relative;
  z-index: 1;
}

.admin-footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  .v-row {
    flex-direction: column;
    gap: 1rem;
  }

  .v-col {
    width: 100%;
  }
}
</style>
