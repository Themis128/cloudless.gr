<template>
  <div class="system-maintenance">
    <v-container class="fill-height">
      <v-row justify="center" align="center">
        <v-col cols="12" md="6" lg="4">
          <v-card class="system-card pa-6" elevation="12">
            <v-card-title class="text-center mb-4">
              <v-icon color="warning" size="32" class="mr-2">mdi-wrench</v-icon>
              System Maintenance
            </v-card-title>
            
            <v-form ref="form" @submit.prevent="handleSystemAccess">
              <v-text-field
                v-model="credentials.username"
                label="System ID"
                prepend-icon="mdi-account-cog"
                variant="outlined"
                :rules="[rules.required]"
                :disabled="loading"
              />
              
              <v-text-field
                v-model="credentials.password"
                :type="showPassword ? 'text' : 'password'"
                label="Access Key"
                prepend-icon="mdi-key-variant"
                :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                variant="outlined"
                :rules="[rules.required]"
                :disabled="loading"
                @click:append="showPassword = !showPassword"
              />
              
              <!-- Admin Creation Section (only shows after system auth) -->
              <div v-if="systemAuthenticated" class="mt-6">
                <v-divider class="mb-4" />
                <h3 class="text-h6 mb-3">Create System Administrator</h3>
                
                <v-text-field
                  v-model="newAdmin.email"
                  label="Admin Email"
                  prepend-icon="mdi-email"
                  variant="outlined"
                  type="email"
                  :rules="[rules.required, rules.email]"
                  :disabled="loading"
                />
                
                <v-text-field
                  v-model="newAdmin.password"
                  :type="showAdminPassword ? 'text' : 'password'"
                  label="Admin Password"
                  prepend-icon="mdi-lock"
                  :append-icon="showAdminPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  variant="outlined"
                  :rules="[rules.required, rules.password]"
                  :disabled="loading"
                  @click:append="showAdminPassword = !showAdminPassword"
                />
                
                <v-text-field
                  v-model="newAdmin.fullName"
                  label="Full Name"
                  prepend-icon="mdi-account"
                  variant="outlined"
                  :rules="[rules.required]"
                  :disabled="loading"
                />
                
                <v-btn
                  type="submit"
                  color="error"
                  block
                  size="large"
                  :loading="loading"
                  :disabled="loading || !isValidAdmin"
                  class="mt-4"
                >
                  <v-icon left>mdi-account-plus</v-icon>
                  Create Administrator
                </v-btn>
              </div>
              
              <!-- System Access Button (shows before auth) -->
              <v-btn
                v-else
                type="submit"
                color="warning"
                block
                size="large"
                :loading="loading"
                :disabled="loading || !isValidCredentials"
                class="mt-4"
              >
                <v-icon left>mdi-login</v-icon>
                System Access
              </v-btn>
            </v-form>
            
            <v-alert
              v-if="error"
              type="error"
              class="mt-4"
              dismissible
              @click:close="error = ''"
            >
              {{ error }}
            </v-alert>
            
            <v-alert
              v-if="success"
              type="success"
              class="mt-4"
              dismissible
              @click:close="success = ''"
            >
              {{ success }}
            </v-alert>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

// Meta configuration
definePageMeta({
  layout: false,
  // Hide from navigation and search engines
  robots: 'noindex,nofollow'
})

// Page head configuration
useHead({
  title: 'System Maintenance',
  meta: [
    { name: 'robots', content: 'noindex,nofollow' },
    { name: 'description', content: 'System maintenance access' }
  ]
})

// Reactive state
const form = ref(null)
const loading = ref(false)
const error = ref('')
const success = ref('')
const showPassword = ref(false)
const showAdminPassword = ref(false)
const systemAuthenticated = ref(false)

const credentials = ref({
  username: '',
  password: ''
})

const newAdmin = ref({
  email: '',
  password: '',
  fullName: ''
})

// Validation rules
const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(v) || 'Invalid email address'
  },
  password: (v: string) => {
    if (!v) return 'Password is required'
    if (v.length < 8) return 'Password must be at least 8 characters'
    if (!/(?=.*[a-z])/.test(v)) return 'Password must contain lowercase letter'
    if (!/(?=.*[A-Z])/.test(v)) return 'Password must contain uppercase letter'
    if (!/(?=.*\d)/.test(v)) return 'Password must contain number'
    if (!/(?=.*[@$!%*?&])/.test(v)) return 'Password must contain special character'
    return true
  }
}

// Computed properties
const isValidCredentials = computed(() => {
  return credentials.value.username && credentials.value.password
})

const isValidAdmin = computed(() => {
  return newAdmin.value.email && 
         newAdmin.value.password && 
         newAdmin.value.fullName &&
         rules.email(newAdmin.value.email) === true &&
         rules.password(newAdmin.value.password) === true
})

// Methods
async function handleSystemAccess() {
  if (!systemAuthenticated.value) {
    await authenticateSystem()
  } else {
    await createAdmin()
  }
}

async function authenticateSystem() {
  loading.value = true
  error.value = ''
  
  try {
    const response = await $fetch('/api/system/auth', {
      method: 'POST',
      body: {
        username: credentials.value.username,
        password: credentials.value.password
      }
    })
    
    if (response.success) {
      systemAuthenticated.value = true
      success.value = response.message || 'System access granted'
      // Clear credentials for security
      credentials.value = { username: '', password: '' }
    } else {
      throw new Error('Authentication failed')
    }  } catch (err: unknown) {
    // Handle both API errors and network errors
    if (err && typeof err === 'object') {
      const errorObj = err as { data?: { statusMessage?: string }; statusMessage?: string }
      if (errorObj.data?.statusMessage) {
        error.value = errorObj.data.statusMessage
      } else if (errorObj.statusMessage) {
        error.value = errorObj.statusMessage
      } else {
        error.value = 'Authentication failed'
      }
    } else if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = 'Authentication failed'
    }
  } finally {
    loading.value = false
  }
}

async function createAdmin() {
  loading.value = true
  error.value = ''
  
  try {
    const response = await $fetch('/api/system/create-admin', {
      method: 'POST',
      body: {
        email: newAdmin.value.email,
        password: newAdmin.value.password,
        fullName: newAdmin.value.fullName,
        username: credentials.value.username // For verification
      }
    })
    
    if (response.success) {
      success.value = response.message || `Administrator created successfully: ${newAdmin.value.email}`
      // Clear form
      newAdmin.value = { email: '', password: '', fullName: '' }
    } else {
      throw new Error('Admin creation failed')
    }
  } catch (err: unknown) {
    // Handle both API errors and network errors
    if (err && typeof err === 'object') {
      const errorObj = err as { data?: { statusMessage?: string }; statusMessage?: string }
      if (errorObj.data?.statusMessage) {
        error.value = errorObj.data.statusMessage
      } else if (errorObj.statusMessage) {
        error.value = errorObj.statusMessage
      } else {
        error.value = 'Admin creation failed'
      }
    } else if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = 'Admin creation failed'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.system-maintenance {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  display: flex;
  align-items: center;
}

.system-card {
  background: rgba(30, 30, 30, 0.95) !important;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.v-field) {
  background: rgba(40, 40, 40, 0.8) !important;
}

:deep(.v-field input) {
  color: #ffffff !important;
}

:deep(.v-label) {
  color: #cccccc !important;
}

:deep(.v-icon) {
  color: #cccccc !important;
}
</style>
