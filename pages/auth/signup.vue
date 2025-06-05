<template>
  <v-container fluid class="fill-height login-container">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="login-card">
          <div class="text-center mb-8">
            <h1 class="text-h4 font-weight-bold text-white">Create your account</h1>
          </div>

          <v-form @submit.prevent="handleSignup">
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              required
              :error-messages="emailError"
              @input="emailError = ''"
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.05)"
              color="white"
              class="login-field"
            />

            <v-text-field
              v-model="password"
              label="Password"
              type="password"
              required
              :error-messages="passwordError"
              @input="passwordError = ''"
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.05)"
              color="white"
              class="login-field mb-4"
            />

            <v-btn
              type="submit"
              block
              size="large"
              :loading="isLoading"
              class="mb-4"
            >
              Sign Up
            </v-btn>
          </v-form>

          <v-alert
            v-if="error"
            type="error"
            class="mt-4"
            closable
            @click:close="error = ''"
          >
            {{ error }}
          </v-alert>

          <v-alert
            v-if="successMessage"
            type="success"
            class="mt-4"
            closable
            @click:close="successMessage = ''"
          >
            {{ successMessage }}
          </v-alert>

          <div class="text-center mt-6">
            <p class="text-body-2 text-medium-emphasis">
              Already have an account?
              <NuxtLink to="/auth/login" class="text-primary">
                Sign in here
              </NuxtLink>
            </p>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  auth: false
})

const supabase = useSupabaseClient()
const router = useRouter()

const email = ref('')
const password = ref('')
const emailError = ref('')
const passwordError = ref('')
const error = ref('')
const successMessage = ref('')
const isLoading = ref(false)

const handleSignup = async () => {
  if (!email.value) {
    emailError.value = 'Email is required'
    return
  }
  if (!password.value) {
    passwordError.value = 'Password is required'
    return
  }
  isLoading.value = true
  error.value = ''
  try {
    const { error: signupError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value
    })
    if (signupError) {
      error.value = signupError.message
    } else {
      successMessage.value = 'Signup successful! Check your email to confirm your account.'
      setTimeout(() => router.push('/auth/login'), 2000)
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
    console.error('Signup error:', err)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container {
  position: relative;
  z-index: 1;
}
.login-card {
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2rem;
}
:deep(.login-field) {
  .v-field__overlay {
    background-color: rgba(255, 255, 255, 0.05);
  }
  .v-field__field {
    color: white !important;
  }
  .v-label {
    color: rgba(255, 255, 255, 0.7);
  }
  input {
    color: white !important;
  }
  .v-field {
    border-color: rgba(255, 255, 255, 0.2);
  }
}
:deep(.v-btn) {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
:deep(.v-alert) {
  background: rgba(76, 175, 80, 0.1) !important;
  color: white;
  border: 1px solid rgba(76, 175, 80, 0.2);
}
</style>
