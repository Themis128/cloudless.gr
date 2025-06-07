<template>
  <div class="position-relative">
    <v-container fluid :class="containerClasses">
      <v-row justify="center" align="center" class="min-h-screen">
        <v-col cols="12" sm="10" md="8" lg="6" xl="4">
          <v-card elevation="3" rounded="lg" :class="cardClasses" :color="cardColor">
            <v-card-title :class="titleClasses">Sign Up</v-card-title>
            <v-card-text>
              <p :class="descriptionClasses">Create your account to get started.</p>

              <form @submit.prevent="handleSignup" class="login-form">
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
                  <v-alert
                    v-if="successMessage"
                    type="success"
                    variant="tonal"
                    :text="successMessage"
                    class="mb-4"
                  />

                  <v-btn
                    type="submit"
                    color="primary"
                    :loading="loading"
                    block
                    :size="buttonSize"
                  >
                    Sign Up
                  </v-btn>

                  <v-divider class="my-4"></v-divider>

                  <p class="text-center text-body-2">
                    Already have an account?
                    <v-btn
                      variant="text"
                      size="small"
                      class="font-weight-medium px-2"
                      to="/auth/login"
                    >
                      Sign In
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
  public: true  // Signup page should be accessible to everyone
})

import { computed, ref } from '#imports'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useSupabaseClient } from '#imports'
import { validateEmail } from '~/utils/auth-client'

const router = useRouter()
const { mobile } = useDisplay()
const supabase = useSupabaseClient()

const form = ref({
  email: '',
  password: ''
})

const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

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

const handleSignup = async () => {
  error.value = ''
  successMessage.value = ''
  loading.value = true

  if (!form.value.email) {
    error.value = 'Email is required'
    loading.value = false
    return
  }
  if (!form.value.password) {
    error.value = 'Password is required'
    loading.value = false
    return
  }

  try {
    const { error: signupError } = await supabase.auth.signUp({
      email: form.value.email,
      password: form.value.password
    })
    if (signupError) {
      error.value = signupError.message
    } else {
      successMessage.value = 'Account created successfully! Please check your email and click the confirmation link to activate your account.'
      // Clear the form
      form.value.email = ''
      form.value.password = ''
      // Don't redirect immediately - let user see the message
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
    console.error('Signup error:', err)
  } finally {
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
