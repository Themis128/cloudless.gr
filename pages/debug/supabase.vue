<template>
  <div>
    <PageStructure
      title="Supabase Connection Diagnostics"
      subtitle="Test and configure your Supabase connection"
      :show-back-button="true"
      back-button-to="/debug"
    >
      <template #main>
        <!-- Connection Status Card -->
        <v-card class="bg-white mb-6">
          <v-card-title class="d-flex align-center">
            <v-icon 
              :color="statusColor" 
              class="me-3" 
              size="32"
            >
              {{ statusIcon }}
            </v-icon>
            Connection Status
          </v-card-title>
          <v-card-text>
            <div class="d-flex align-center mb-4">
              <v-chip 
                :color="statusColor" 
                :variant="connectionStatus === 'connected' ? 'elevated' : 'outlined'"
                size="large"
                class="me-4"
              >
                {{ connectionStatus.toUpperCase() }}
              </v-chip>
              <v-btn 
                color="primary" 
                variant="outlined" 
                @click="testConnection"
                :loading="testing"
                size="small"
              >
                Test Connection
              </v-btn>
            </div>
            
            <v-alert 
              v-if="connectionMessage"
              :type="connectionStatus === 'connected' ? 'success' : 'error'"
              variant="tonal"
              class="mb-4"
            >
              {{ connectionMessage }}
            </v-alert>
            
            <div v-if="healthCheckResult">
              <h4 class="text-h6 mb-3">Latest Health Check Results:</h4>
              <v-code class="d-block pa-4 mb-4">
                {{ JSON.stringify(healthCheckResult, null, 2) }}
              </v-code>
            </div>
          </v-card-text>
        </v-card>

        <!-- Environment Variables Check -->
        <v-card class="bg-white mb-6">
          <v-card-title>
            <v-icon start color="info">mdi-cog</v-icon>
            Environment Variables
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item>
                <template #prepend>
                  <v-icon :color="envVars.hasUrl ? 'success' : 'error'">
                    {{ envVars.hasUrl ? 'mdi-check' : 'mdi-close' }}
                  </v-icon>
                </template>
                <v-list-item-title>NUXT_PUBLIC_SUPABASE_URL</v-list-item-title>
                <v-list-item-subtitle>
                  {{ envVars.hasUrl ? envVars.urlPreview : 'Not configured' }}
                </v-list-item-subtitle>
              </v-list-item>
              
              <v-list-item>
                <template #prepend>
                  <v-icon :color="envVars.hasKey ? 'success' : 'error'">
                    {{ envVars.hasKey ? 'mdi-check' : 'mdi-close' }}
                  </v-icon>
                </template>
                <v-list-item-title>NUXT_PUBLIC_SUPABASE_ANON_KEY</v-list-item-title>
                <v-list-item-subtitle>
                  {{ envVars.hasKey ? 'Configured (hidden for security)' : 'Not configured' }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Setup Instructions -->
        <v-card class="bg-white mb-6" v-if="connectionStatus !== 'connected'">
          <v-card-title>
            <v-icon start color="warning">mdi-book</v-icon>
            Setup Instructions
          </v-card-title>
          <v-card-text>
            <v-stepper v-model="currentStep" alt-labels>
              <v-stepper-header>
                <v-stepper-item
                  :complete="currentStep > 1"
                  step="1"
                  title="Create Supabase Project"
                />
                <v-divider />
                <v-stepper-item
                  :complete="currentStep > 2"
                  step="2"
                  title="Get Credentials"
                />
                <v-divider />
                <v-stepper-item
                  :complete="currentStep > 3"
                  step="3"
                  title="Configure Environment"
                />
                <v-divider />
                <v-stepper-item
                  step="4"
                  title="Test Connection"
                />
              </v-stepper-header>

              <v-stepper-window>
                <v-stepper-window-item value="1">
                  <v-card flat>
                    <v-card-text>
                      <h4 class="text-h6 mb-3">1. Create a Supabase Project</h4>
                      <ol>
                        <li>Go to <a href="https://supabase.com" target="_blank">supabase.com</a></li>
                        <li>Sign up or log in to your account</li>
                        <li>Click "New Project"</li>
                        <li>Choose your organization and fill in project details</li>
                        <li>Select a region close to your users</li>
                        <li>Set a strong database password</li>
                        <li>Click "Create new project"</li>
                      </ol>
                    </v-card-text>
                    <v-card-actions>
                      <v-btn color="primary" @click="currentStep = 2">Next</v-btn>
                    </v-card-actions>
                  </v-card>
                </v-stepper-window-item>

                <v-stepper-window-item value="2">
                  <v-card flat>
                    <v-card-text>
                      <h4 class="text-h6 mb-3">2. Get Your Credentials</h4>
                      <ol>
                        <li>In your Supabase dashboard, go to Settings → API</li>
                        <li>Copy the "Project URL" (starts with https://)</li>
                        <li>Copy the "anon public" key (long string starting with eyJ)</li>
                        <li>Keep these credentials secure</li>
                      </ol>
                    </v-card-text>
                    <v-card-actions>
                      <v-btn variant="outlined" @click="currentStep = 1">Back</v-btn>
                      <v-btn color="primary" @click="currentStep = 3">Next</v-btn>
                    </v-card-actions>
                  </v-card>
                </v-stepper-window-item>

                <v-stepper-window-item value="3">
                  <v-card flat>
                    <v-card-text>
                      <h4 class="text-h6 mb-3">3. Configure Environment Variables</h4>
                      <p class="mb-3">Create a <code>.env</code> file in your project root with:</p>
                      <v-code class="d-block pa-4 mb-4">
                        NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
                        NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
                      </v-code>
                      <v-alert type="warning" variant="tonal" class="mb-4">
                        <strong>Important:</strong> Replace the placeholder values with your actual Supabase credentials.
                        Never commit your actual keys to version control.
                      </v-alert>
                    </v-card-text>
                    <v-card-actions>
                      <v-btn variant="outlined" @click="currentStep = 2">Back</v-btn>
                      <v-btn color="primary" @click="currentStep = 4">Next</v-btn>
                    </v-card-actions>
                  </v-card>
                </v-stepper-window-item>

                <v-stepper-window-item value="4">
                  <v-card flat>
                    <v-card-text>
                      <h4 class="text-h6 mb-3">4. Test Your Connection</h4>
                      <p class="mb-3">After setting up your environment variables:</p>
                      <ol>
                        <li>Restart your development server</li>
                        <li>Refresh this page</li>
                        <li>Click "Test Connection" above</li>
                        <li>Verify that the status shows "CONNECTED"</li>
                      </ol>
                    </v-card-text>
                    <v-card-actions>
                      <v-btn variant="outlined" @click="currentStep = 3">Back</v-btn>
                      <v-btn color="success" @click="testConnection">Test Now</v-btn>
                    </v-card-actions>
                  </v-card>
                </v-stepper-window-item>
              </v-stepper-window>
            </v-stepper>
          </v-card-text>
        </v-card>

        <!-- Database Tables Check -->
        <v-card class="bg-white mb-6" v-if="connectionStatus === 'connected'">
          <v-card-title>
            <v-icon start color="success">mdi-database</v-icon>
            Database Tables
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="table in requiredTables"
                :key="table.name"
              >
                <template #prepend>
                  <v-icon :color="table.exists ? 'success' : 'warning'">
                    {{ table.exists ? 'mdi-check' : 'mdi-alert' }}
                  </v-icon>
                </template>
                <v-list-item-title>{{ table.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ table.exists ? `${table.count} records` : 'Table may not exist or be empty' }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            
            <v-btn 
              color="primary" 
              variant="outlined" 
              @click="checkTables"
              :loading="checkingTables"
              class="mt-4"
            >
              Refresh Table Status
            </v-btn>
          </v-card-text>
        </v-card>

        <!-- Troubleshooting -->
        <v-card class="bg-white">
          <v-card-title>
            <v-icon start color="info">mdi-help-circle</v-icon>
            Troubleshooting
          </v-card-title>
          <v-card-text>
            <v-expansion-panels>
              <v-expansion-panel>
                <v-expansion-panel-title>Connection Fails</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <ul>
                    <li>Verify your Supabase project is active and not paused</li>
                    <li>Check that your URL and key are correct</li>
                    <li>Ensure there are no extra spaces in your environment variables</li>
                    <li>Restart your development server after changing .env</li>
                  </ul>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel>
                <v-expansion-panel-title>Tables Not Found</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <ul>
                    <li>Make sure you've run database migrations</li>
                    <li>Check if tables exist in your Supabase dashboard</li>
                    <li>Verify your database schema matches the expected structure</li>
                    <li>Check Row Level Security (RLS) policies if tables seem empty</li>
                  </ul>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel>
                <v-expansion-panel-title>Authentication Issues</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <ul>
                    <li>Ensure you're using the anon key, not the service role key</li>
                    <li>Check your Supabase authentication settings</li>
                    <li>Verify Row Level Security policies allow anonymous access where needed</li>
                  </ul>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import { useSupabase, testSupabaseConnection, getSupabaseConnectionStatus } from '~/composables/supabase'

// Reactive data
const testing = ref(false)
const checkingTables = ref(false)
const connectionStatus = ref<'connected' | 'error' | 'not-configured'>('not-configured')
const connectionMessage = ref('')
const healthCheckResult = ref<any>(null)
const currentStep = ref(1)

// Environment variables check
const envVars = ref({
  hasUrl: false,
  hasKey: false,
  urlPreview: '',
})

// Required tables for the application
const requiredTables = ref([
  { name: 'bots', exists: false, count: 0 },
  { name: 'models', exists: false, count: 0 },
  { name: 'pipelines', exists: false, count: 0 },
  { name: 'network_logs', exists: false, count: 0 },
  { name: 'analytics_executions', exists: false, count: 0 },
])

// Computed properties
const statusColor = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'success'
    case 'error': return 'error'
    default: return 'warning'
  }
})

const statusIcon = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'mdi-check-circle'
    case 'error': return 'mdi-alert-circle'
    default: return 'mdi-help-circle'
  }
})

// Methods
const testConnection = async () => {
  testing.value = true
  connectionMessage.value = ''
  
  try {
    // Test client-side connection
    const status = await testSupabaseConnection()
    connectionStatus.value = status
    
    // Test server-side health check
    const response = await $fetch('/api/health/supabase')
    healthCheckResult.value = response
    
    if (response.status === 'success') {
      connectionStatus.value = 'connected'
      connectionMessage.value = 'Supabase connection is working perfectly!'
    } else {
      connectionStatus.value = 'error'
      connectionMessage.value = response.message || 'Connection test failed'
    }
  } catch (error: any) {
    connectionStatus.value = 'error'
    connectionMessage.value = `Connection test failed: ${error.message}`
    healthCheckResult.value = { error: error.message }
  }
  
  testing.value = false
}

const checkEnvironmentVariables = () => {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const key = config.public.supabaseKey as string
  
  envVars.value = {
    hasUrl: !!url,
    hasKey: !!key,
    urlPreview: url ? `${url.substring(0, 30)}...` : '',
  }
}

const checkTables = async () => {
  if (connectionStatus.value !== 'connected') return
  
  checkingTables.value = true
  const supabase = useSupabase()
  
  for (const table of requiredTables.value) {
    try {
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })
      
      table.exists = !error
      table.count = count || 0
    } catch {
      table.exists = false
      table.count = 0
    }
  }
  
  checkingTables.value = false
}

// Lifecycle
onMounted(async () => {
  checkEnvironmentVariables()
  connectionStatus.value = getSupabaseConnectionStatus()
  
  if (connectionStatus.value === 'connected') {
    await checkTables()
  }
  
  // Auto-test connection if environment variables are present
  if (envVars.value.hasUrl && envVars.value.hasKey) {
    await testConnection()
  }
})
</script>

<style scoped>
.v-code {
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
}

.v-stepper {
  box-shadow: none !important;
}
</style>