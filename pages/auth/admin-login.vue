<template>
  <div class="position-relative">
    <v-container fluid :class="containerClasses">
      <v-row justify="center" align="center" class="min-h-screen">
        <v-col cols="12" sm="10" md="8" lg="6" xl="4">
          <v-card elevation="3" rounded="lg" :class="cardClasses" :color="cardColor">
            <v-card-title :class="titleClasses">Admin Login</v-card-title>
            <v-card-text>
              <p :class="descriptionClasses">Please log in to access the admin panel.</p>

              <form @submit.prevent="handleLogin" class="login-form">
                <v-text-field
                  v-model="form.email"
                  label="Email"
                  type="email"
                  :rules="[rules.required, rules.email]"
                  required
                  variant="outlined"
                  :disabled="loading"
                />

                <v-text-field
                  v-model="form.password"
                  label="Password"
                  :rules="[rules.required]"
                  required
                  variant="outlined"
                  :disabled="loading"
                  :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showPassword = !showPassword"
                  :type="showPassword ? 'text' : 'password'"
                />

                <div class="d-flex flex-column gap-4 mt-6">
                  <v-alert
                    v-if="error"
                    type="error"
                    variant="tonal"
                    :text="error"
                    class="mb-4"
                  />

                  <v-btn
                    type="submit"
                    color="primary"
                    :loading="loading"
                    block
                    :size="buttonSize"
                  >
                    Log In as Admin
                  </v-btn>

                  <v-divider class="my-4"></v-divider>

                  <p class="text-center text-body-2">
                    Not an admin?
                    <v-btn
                      variant="text"
                      size="small"
                      class="font-weight-medium px-2"
                      to="/auth/login"
                    >
                      User Login
                    </v-btn>
                  </p>
                </div>
              </form>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  public: true  // Admin login page should be accessible without auth
})

import { computed, ref, useRouter } from '#imports'
import { useDisplay } from 'vuetify'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { validateEmail } from '~/utils/auth-client'

const router = useRouter()
const { mobile } = useDisplay()
const { adminSignIn } = useAdminAuth()

const form = ref({
  email: '',
  password: ''
})

const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const rules = {
  required: (v: string) => !!v || 'This field is required',
  email: (v: string) => validateEmail(v) || 'Invalid email address'
}

const containerClasses = computed(() => ['index-container', mobile ? 'px-4 py-4' : 'px-6 py-8'])
const cardClasses = computed(() => ['text-center login-card backdrop-blur', mobile ? 'pa-6' : 'pa-8'])
const titleClasses = computed(() => ['font-weight-bold text-primary mb-4', mobile ? 'text-h4' : 'text-h3'])
const descriptionClasses = computed(() => ['text-medium-emphasis', mobile ? 'text-body-2 mb-6' : 'text-body-1 mb-8'])
const buttonSize = computed(() => (mobile ? 'large' : 'x-large'))
const cardColor = computed(() => 'rgb(255, 255, 255, 0.85)')

const handleLogin = async () => {
  error.value = ''
  loading.value = true

  // Add timeout to prevent infinite loading
  const timeoutId = setTimeout(() => {
    if (loading.value) {
      loading.value = false
      error.value = 'Login request timed out. Please try again.'
    }
  }, 30000) // 30 second timeout

  try {
    const result = await adminSignIn(form.value.email, form.value.password)

    // Clear timeout on successful response
    clearTimeout(timeoutId)

    if (!result.success) {
      error.value = result.error || 'Login failed. Please check your credentials.'
      return
    }

    // Only navigate if login was successful
    await router.push('/admin/dashboard')
  } catch (err) {
    // Clear timeout on error
    clearTimeout(timeoutId)
    error.value = 'Failed to log in. Please try again.'
    console.error('Admin login error:', err)
  } finally {
    // Ensure loading state is always reset
    loading.value = false
  }
}
</script>

<style scoped>
.position-relative {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
}

.index-container {
  background: transparent;
  z-index: 1;
  position: relative;
}

.min-h-screen {
  min-height: 90vh;
}

.login-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.backdrop-blur {
  position: relative;
  overflow: hidden;
}

.backdrop-blur::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: -1;
}

.login-form {
  max-width: 100%;
}
</style>
