<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="pa-6" elevation="4">
          <v-card-title class="text-h5 mb-4">Login</v-card-title>

          <v-form @submit.prevent="login" ref="form">            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              prepend-inner-icon="mdi-email"
              required
              :disabled="loading"
              :rules="[rules.required, rules.email]"
              validate-on="blur"
            />

            <v-text-field
              v-model="password"
              label="Password"
              type="password"
              prepend-inner-icon="mdi-lock"
              required
              :disabled="loading"
              :rules="[rules.required, rules.minLength]"
              validate-on="blur"
            />            <v-btn
              color="primary"
              block
              class="mt-4"
              :loading="loading"
              type="submit"
            >
              Login
            </v-btn>

            <!-- Debug buttons for testing navigation methods -->
            <v-row v-if="success" class="mt-2">
              <v-col cols="4">
                <v-btn
                  size="small"
                  color="info"
                  block
                  @click="testNavigateTo"
                >
                  Test navigateTo
                </v-btn>
              </v-col>
              <v-col cols="4">
                <v-btn
                  size="small"
                  color="info"
                  block
                  @click="testWindowLocation"
                >
                  Test window.location
                </v-btn>
              </v-col>
              <v-col cols="4">
                <v-btn
                  size="small"
                  color="info"
                  block
                  @click="testPushState"
                >
                  Test pushState
                </v-btn>
              </v-col>
            </v-row><v-alert
              v-if="success"
              type="success"
              class="mt-4"
              dense
              border="start"
              color="success"
            >
              Login successful! Redirecting...
            </v-alert>

            <v-alert
              v-if="error"
              type="error"
              class="mt-4"
              dense
              border="start"
              color="error"
            >
              {{ error }}
            </v-alert>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  public: true,
})

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const success = ref(false)
const form = ref()

const route = useRoute()

// Form validation rules
const rules = {
  required: (value: string) => !!value || 'This field is required',
  email: (value: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(value) || 'Please enter a valid email address'
  },
  minLength: (value: string) => value.length >= 6 || 'Password must be at least 6 characters'
}

async function login() {
  console.log('🚀 [Client] LOGIN DEBUG: Starting login process...')
  console.log('📧 [Client] Email:', email.value)
  console.log('🔒 [Client] Password length:', password.value.length)
  console.log('🔗 [Client] Route query:', route.query)
  console.log('🌐 [Client] Current URL:', window.location.href)
  
  // Validate form first
  const { valid } = await form.value.validate()
  if (!valid) {
    console.log('❌ [Client] Form validation failed')
    return
  }
  
  error.value = ''
  success.value = false
  loading.value = true
  
  const startTime = Date.now()

  try {
    console.log('📡 [Client] Making API call to /api/auth/supabase-login...')
    console.log('⏰ [Client] Request timestamp:', new Date().toISOString())
      const response = await $fetch('/api/auth/supabase-login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
      },
      credentials: 'include' // CRITICAL: Ensures cookies are sent/received
    })

    const responseTime = Date.now() - startTime
    console.log(`✅ [Client] Login response (${responseTime}ms):`, response)
    console.log('🔍 [Client] Response type:', typeof response)
    console.log('🔍 [Client] Response keys:', Object.keys(response || {}))
    console.log('🔍 [Client] Response.authenticated:', response.authenticated)
    console.log('🔍 [Client] Response.success:', response.success)
    console.log('🔍 [Client] Response.user:', response.user ? 'User object present' : 'No user object')

    if (response && response.authenticated === true) {
      const redirectTo = route.query.redirect?.toString() || '/dashboard'
      console.log('🎯 [Client] Login successful! Redirecting to:', redirectTo)
      console.log('🔄 [Client] About to call navigateTo...')
      console.log('⏰ [Client] Pre-redirect timestamp:', new Date().toISOString())
        // Show success state briefly before redirect
      success.value = true
      
      console.log('🚀 [Client] Executing redirect...')
      console.log('🔧 [Client] Using window.location.href for reliable redirect...')
      
      // Use direct window.location.href to bypass any Nuxt navigation issues
      setTimeout(() => {
        console.log('🎯 [Client] Redirecting now to:', redirectTo)
        window.location.href = redirectTo
      }, 1000) // Give user time to see success message
      
      console.log('⏰ [Client] Post-redirect timestamp:', new Date().toISOString())
    } else {
      console.log('❌ [Client] Authentication failed - response.authenticated is false or missing')
      console.log('🔍 [Client] Full response object:', JSON.stringify(response, null, 2))
      error.value = response?.message || 'Login failed. Please check your credentials.'
    }
  } catch (err: any) {
    const errorTime = Date.now() - startTime
    console.error(`💥 [Client] LOGIN ERROR (${errorTime}ms):`, err)
    console.error('📊 [Client] Error details:', {
      message: err.message,
      data: err.data,
      statusCode: err.statusCode,
      statusMessage: err?.data?.statusMessage,
      response: err?.response,
      cause: err?.cause
    })
    console.error('🔍 [Client] Error stack:', err.stack)
    
    if (err.statusCode === 401) {
      error.value = 'Invalid email or password. Please check your credentials.'
    } else if (err.statusCode === 500) {
      error.value = 'Server error. Please try again later.'
    } else {
      error.value = err?.data?.statusMessage || err?.message || 'Login failed. Please try again.'
    }
  } finally {
    loading.value = false
    console.log('🏁 [Client] Login process completed, loading state reset')
    console.log(`⏱️ [Client] Total process time: ${Date.now() - startTime}ms`)  }
}

// Debug navigation functions
async function testNavigateTo() {
  console.log('🧪 [Client] Testing navigateTo...')
  try {
    await navigateTo('/dashboard')
    console.log('✅ [Client] navigateTo test successful')
  } catch (error) {
    console.error('❌ [Client] navigateTo test failed:', error)
  }
}

function testWindowLocation() {
  console.log('🧪 [Client] Testing window.location.href...')
  window.location.href = '/dashboard'
}

function testPushState() {
  console.log('🧪 [Client] Testing history.pushState + manual navigation...')
  history.pushState({}, '', '/dashboard')
  window.location.reload()
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
  background-color: #f5f5f5;
}
</style>
