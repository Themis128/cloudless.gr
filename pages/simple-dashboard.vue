<template>
  <div class="simple-dashboard">
    <v-container class="py-8">
      <v-row>
        <v-col cols="12">
          <!-- Simple Welcome Card -->
          <v-card class="mb-6" elevation="2">
            <v-card-title class="text-h4 pa-6">
              <v-icon icon="mdi-view-dashboard" class="me-3" color="primary"></v-icon>
              Dashboard
            </v-card-title>
            <v-card-text>
              <p class="text-body-1">Welcome to your dashboard!</p>
              <p class="text-caption text-medium-emphasis">
                User: {{ user?.email || 'Not logged in' }}
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <!-- Quick Actions -->
        <v-col cols="12" md="6">
          <v-card elevation="2">
            <v-card-title>Quick Actions</v-card-title>
            <v-card-text>
              <div class="d-flex flex-column gap-2">
                <v-btn 
                  to="/projects" 
                  color="primary" 
                  variant="elevated" 
                  block
                >
                  <v-icon start icon="mdi-folder"></v-icon>
                  View Projects
                </v-btn>
                
                <v-btn 
                  to="/settings" 
                  color="secondary" 
                  variant="outlined" 
                  block
                >
                  <v-icon start icon="mdi-cog"></v-icon>
                  Settings
                </v-btn>
                
                <v-btn 
                  to="/diagnostics" 
                  color="info" 
                  variant="outlined" 
                  block
                >
                  <v-icon start icon="mdi-medical-bag"></v-icon>
                  System Check
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Status -->
        <v-col cols="12" md="6">
          <v-card elevation="2">
            <v-card-title>System Status</v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check-circle" color="success"></v-icon>
                  </template>
                  <v-list-item-title>Application</v-list-item-title>
                  <v-list-item-subtitle>Running</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <template #prepend>
                    <v-icon :icon="user ? 'mdi-check-circle' : 'mdi-account-off'" 
                            :color="user ? 'success' : 'warning'"></v-icon>
                  </template>
                  <v-list-item-title>Authentication</v-list-item-title>
                  <v-list-item-subtitle>{{ user ? 'Authenticated' : 'Not authenticated' }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
// Simple dashboard with minimal dependencies
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

// Just get the user, no complex data loading
const user = useSupabaseUser()
</script>

<style scoped>
.simple-dashboard {
  min-height: 100vh;
}
</style>
