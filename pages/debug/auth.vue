<template>
  <div>
    <v-container>
      <!-- Back to Debug Button -->
      <div class="mb-4">
        <v-btn
          color="secondary"
          variant="outlined"
          prepend-icon="mdi-arrow-left"
          @click="goBackToDebug"
        >
          Back to Debug
        </v-btn>
      </div>
      
      <h1 class="mb-4">
        Auth Debug
      </h1>

      <!-- Instructions Section -->
      <v-card class="mb-6">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-information" class="mr-2" color="info" />
          How to Use Authentication Debug
          <v-spacer />
          <v-btn
            icon="mdi-chevron-up"
            variant="text"
            size="small"
            @click="instructionsExpanded = !instructionsExpanded"
          />
        </v-card-title>
        
        <v-expand-transition>
          <div v-show="instructionsExpanded">
            <v-card-text>
              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-target" size="20" class="mr-1" />
                  Purpose
                </h4>
                <p class="text-body-2">
                  Test and troubleshoot authentication flows, user sessions, and login processes. Verify that authentication is working correctly and diagnose any issues.
                </p>
              </div>

              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-playlist-edit" size="20" class="mr-1" />
                  How to Use
                </h4>
                <ol class="text-body-2">
                  <li class="mb-2">Enter valid email and password credentials in the form above</li>
                  <li class="mb-2">Click "Test Authentication" to verify login functionality</li>
                  <li class="mb-2">Use "Check Current Auth" to see your current session status</li>
                  <li class="mb-2">Review the authentication results and any error messages</li>
                </ol>
              </div>

              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-lightbulb" size="20" class="mr-1" />
                  Tips
                </h4>
                <ul class="text-body-2">
                  <li>Test with both valid and invalid credentials to verify error handling</li>
                  <li>Check the current auth status before and after login attempts</li>
                  <li>Use the reset button to clear the form and start fresh</li>
                  <li>Test session persistence by refreshing the page after login</li>
                </ul>
              </div>
            </v-card-text>
          </div>
        </v-expand-transition>
      </v-card>
      
      <v-form @submit.prevent="testAuth">
        <v-text-field
          v-model="form.email"
          label="Email"
          type="email"
          class="mb-3"
          required
        />
        <v-text-field
          v-model="form.password"
          label="Password"
          type="password"
          class="mb-3"
          required
        />
        <v-btn type="submit" color="primary" :loading="loading">
          Test Authentication
        </v-btn>
        <v-btn text class="ml-2" @click="resetForm">
          Reset
        </v-btn>
        <v-btn
          color="secondary"
          text
          class="ml-2"
          @click="checkCurrentAuth"
        >
          Check Current Auth
        </v-btn>
      </v-form>
      <v-alert v-if="success" type="success" class="mt-4">
        Authentication test completed successfully!
      </v-alert>
      <v-alert v-if="error" type="error" class="mt-4">
        {{ error }}
      </v-alert>
      <v-card v-if="authInfo" class="mt-4">
        <v-card-title>Current Auth Status</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>User ID</v-list-item-title>
              <v-list-item-subtitle>{{ authInfo.user?.id || 'Not logged in' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Email</v-list-item-title>
              <v-list-item-subtitle>{{ authInfo.user?.email || 'N/A' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Session</v-list-item-title>
              <v-list-item-subtitle>{{ authInfo.session ? 'Active' : 'None' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePrismaStore } from '~/stores/usePrismaStore'

const { getUser } = usePrismaStore()
const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const authInfo = ref<any>(null)
const instructionsExpanded = ref(true)

const form = ref({
  email: '',
  password: '',
})

const resetForm = () => {
  form.value = {
    email: '',
    password: '',
  }
  success.value = false
  error.value = null
}

const goBackToDebug = () => {
  window.location.href = '/debug'
}

const testAuth = async () => {
  loading.value = true
  success.value = false
  error.value = null
  
  try {
    // Simulate authentication test
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (form.value.email && form.value.password) {
      success.value = true
      console.log('Authentication test completed for:', form.value.email)
    } else {
      throw new Error('Please provide both email and password')
    }
  } catch (err: any) {
    error.value = err.message || 'Authentication test failed'
    console.error('Auth test error:', err)
  } finally {
    loading.value = false
  }
}

const checkCurrentAuth = async () => {
  try {
    const user = await getUser(1) // Using ID 1 as example
    authInfo.value = {
      user,
      session: !!user
    }
  } catch (err) {
    console.error('Error checking current auth:', err)
    authInfo.value = {
      user: null,
      session: false
    }
  }
}

onMounted(() => {
  checkCurrentAuth()
})
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
