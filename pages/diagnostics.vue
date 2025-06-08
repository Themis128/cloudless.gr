<template>
  <div class="diagnostic-container">
    <v-container class="py-8">
      <v-row justify="center">
        <v-col cols="12" md="8" lg="6">
          <v-card elevation="3" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);">
            <v-card-title class="text-h4 pa-6 d-flex align-center">
              <v-icon icon="mdi-medical-bag" class="me-3" color="primary"></v-icon>
              System Health Check
            </v-card-title>
            
            <v-card-text>
              <v-list>
                <!-- Environment Check -->
                <v-list-item>
                  <template #prepend>
                    <v-icon :icon="checks.env.status ? 'mdi-check-circle' : 'mdi-alert-circle'" 
                            :color="checks.env.status ? 'success' : 'error'"></v-icon>
                  </template>
                  <v-list-item-title>Environment Variables</v-list-item-title>
                  <v-list-item-subtitle>{{ checks.env.message }}</v-list-item-subtitle>
                </v-list-item>

                <!-- Supabase Connection -->
                <v-list-item>
                  <template #prepend>
                    <v-icon :icon="checks.supabase.status ? 'mdi-check-circle' : 'mdi-alert-circle'" 
                            :color="checks.supabase.status ? 'success' : 'error'"></v-icon>
                  </template>
                  <v-list-item-title>Supabase Connection</v-list-item-title>
                  <v-list-item-subtitle>{{ checks.supabase.message }}</v-list-item-subtitle>
                </v-list-item>

                <!-- Auth Status -->
                <v-list-item>
                  <template #prepend>
                    <v-icon :icon="checks.auth.status ? 'mdi-check-circle' : 'mdi-information'" 
                            :color="checks.auth.status ? 'success' : 'info'"></v-icon>
                  </template>
                  <v-list-item-title>Authentication Status</v-list-item-title>
                  <v-list-item-subtitle>{{ checks.auth.message }}</v-list-item-subtitle>
                </v-list-item>

                <!-- Network Test -->
                <v-list-item>
                  <template #prepend>
                    <v-icon :icon="checks.network.status ? 'mdi-check-circle' : 'mdi-alert-circle'" 
                            :color="checks.network.status ? 'success' : 'error'"></v-icon>
                  </template>
                  <v-list-item-title>Network Connectivity</v-list-item-title>
                  <v-list-item-subtitle>{{ checks.network.message }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>

              <v-divider class="my-4"></v-divider>

              <div class="text-center">
                <v-btn 
                  color="primary" 
                  variant="elevated" 
                  @click="runDiagnostics"
                  :loading="loading"
                  class="me-2"
                >
                  <v-icon start icon="mdi-refresh"></v-icon>
                  Run Check Again
                </v-btn>
                
                <v-btn 
                  color="secondary" 
                  variant="outlined" 
                  to="/dashboard"
                >
                  Go to Dashboard
                </v-btn>
              </div>

              <!-- Detailed Results -->
              <v-expand-transition>
                <div v-if="showDetails">
                  <v-divider class="my-4"></v-divider>
                  <v-card variant="tonal" class="pa-3">
                    <h4 class="mb-2">Detailed Information:</h4>
                    <pre class="text-caption">{{ JSON.stringify(detailedResults, null, 2) }}</pre>
                  </v-card>
                </div>
              </v-expand-transition>

              <div class="text-center mt-4">
                <v-btn 
                  variant="text" 
                  size="small" 
                  @click="showDetails = !showDetails"
                >
                  {{ showDetails ? 'Hide' : 'Show' }} Details
                  <v-icon :icon="showDetails ? 'mdi-chevron-up' : 'mdi-chevron-down'"></v-icon>
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
definePageMeta({
  layout: 'default',
  title: 'System Diagnostics'
})

const loading = ref(false)
const showDetails = ref(false)

const checks = ref({
  env: { status: false, message: 'Checking...' },
  supabase: { status: false, message: 'Checking...' },
  auth: { status: false, message: 'Checking...' },
  network: { status: false, message: 'Checking...' }
})

const detailedResults = ref({})

const runDiagnostics = async () => {
  loading.value = true
  
  try {
    // Reset checks
    checks.value = {
      env: { status: false, message: 'Checking environment variables...' },
      supabase: { status: false, message: 'Testing Supabase connection...' },
      auth: { status: false, message: 'Checking authentication...' },
      network: { status: false, message: 'Testing network connectivity...' }
    }

    // Check environment variables
    try {
      const config = useRuntimeConfig()
      if (config.public.supabase?.url && config.public.supabase?.anonKey) {
        checks.value.env = { status: true, message: 'Environment variables configured correctly' }
      } else {
        checks.value.env = { status: false, message: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' }
      }
    } catch (error: any) {
      checks.value.env = { status: false, message: `Environment check failed: ${error.message}` }
    }

    // Check Supabase connection
    try {
      const supabase = useSupabaseClient()
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        if (error.message.includes('fetch')) {
          checks.value.supabase = { status: false, message: 'Network error - cannot reach Supabase' }
        } else {
          checks.value.supabase = { status: false, message: `Supabase error: ${error.message}` }
        }
      } else {
        checks.value.supabase = { status: true, message: 'Successfully connected to Supabase' }
      }
    } catch (error: any) {
      checks.value.supabase = { status: false, message: `Connection failed: ${error.message}` }
    }

    // Check authentication
    try {
      const user = useSupabaseUser()
      if (user.value) {
        checks.value.auth = { status: true, message: `Authenticated as ${user.value.email}` }
      } else {
        checks.value.auth = { status: false, message: 'Not authenticated (this is normal for public pages)' }
      }
    } catch (error: any) {
      checks.value.auth = { status: false, message: `Auth check failed: ${error.message}` }
    }

    // Test network connectivity
    try {
      const response = await fetch('https://httpbin.org/get', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        checks.value.network = { status: true, message: 'Network connectivity is working' }
      } else {
        checks.value.network = { status: false, message: `Network test failed with status: ${response.status}` }
      }
    } catch (error: any) {
      if (error.message.includes('fetch')) {
        checks.value.network = { status: false, message: 'Network connectivity issues detected' }
      } else {
        checks.value.network = { status: false, message: `Network test error: ${error.message}` }
      }
    }

    // Store detailed results
    detailedResults.value = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      checks: checks.value
    }

  } catch (error: any) {
    console.error('Diagnostic error:', error)
  } finally {
    loading.value = false
  }
}

// Run diagnostics on mount
onMounted(() => {
  runDiagnostics()
})
</script>

<style scoped>
.diagnostic-container {
  position: relative;
  min-height: 100vh;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
}
</style>
