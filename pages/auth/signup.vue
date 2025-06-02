<template>
  <div class="position-relative">
    <v-container fluid :class="containerClasses">
      <v-row justify="center" align="center" class="min-h-screen">
        <v-col cols="12" sm="10" md="8" lg="6" xl="4">
          <v-card elevation="3" rounded="lg" :class="cardClasses" :color="cardColor">
            <v-card-title :class="titleClasses">Create Account</v-card-title>
            <v-card-text>
              <form @submit.prevent="handleSignup" class="signup-form">
                <v-text-field
                  v-model="form.fullName"
                  label="Full Name"
                  :rules="[rules.required]"
                  required
                  variant="outlined"
                  :disabled="loading"
                />

                <v-text-field
                  v-model="form.email"
                  label="Email"
                  type="email"
                  :rules="[rules.required, rules.email]"
                  required
                  variant="outlined"
                  :disabled="loading"
                />                <v-text-field
                  v-model="form.password"
                  label="Password"
                  :rules="[rules.required, rules.password]"
                  required
                  variant="outlined"
                  :disabled="loading"
                  :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showPassword = !showPassword"
                  :type="showPassword ? 'text' : 'password'"
                />

                <v-text-field
                  v-model="form.confirmPassword"
                  label="Confirm Password"
                  :rules="[rules.required, rules.confirmPassword]"
                  required
                  variant="outlined"
                  :disabled="loading"
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
                      Log In
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
import { computed, ref } from '#imports';
import { navigateTo } from 'nuxt/app';
import { useDisplay } from 'vuetify';
import { validateEmail, validatePassword } from '~/utils/auth';

definePageMeta({
  layout: 'login',
  auth: false
})
const { mobile } = useDisplay();

// Form state
const form = ref({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
});

const showPassword = ref(false);
const loading = ref(false);
const error = ref('');

// Validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
  email: (v: string) => validateEmail(v) || 'Invalid email address',
  password: (v: string) => validatePassword(v) || 'Password must be at least 8 characters with uppercase, lowercase and numbers',
  confirmPassword: (v: string) => v === form.value.password || 'Passwords do not match',
};

// Computed classes for responsive design
const containerClasses = computed(() => ['index-container', mobile ? 'px-4 py-4' : 'px-6 py-8']);
const cardClasses = computed(() => ['text-center signup-card backdrop-blur', mobile ? 'pa-6' : 'pa-8']);
const titleClasses = computed(() => ['font-weight-bold text-primary mb-4', mobile ? 'text-h4' : 'text-h3']);
const buttonSize = computed(() => (mobile ? 'large' : 'x-large'));
const cardColor = computed(() => 'rgb(255, 255, 255, 0.85)');

// Handle form submission
const handleSignup = async () => {
  error.value = '';
  loading.value = true;

  try {
    interface SignupResponse {
      success: boolean
      message: string
      user?: any
      token?: string
    }

    const response = await $fetch<SignupResponse>('/api/auth/signup', {
      method: 'POST',
      body: {
        fullName: form.value.fullName,
        email: form.value.email,
        password: form.value.password,
      },
    });

    if (!response.success) {
      error.value = response.message;
      return;
    }

    // Store token and user data
    if (response.token && response.user) {
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('auth_user', JSON.stringify(response.user));
    }

    // Redirect to dashboard
    await navigateTo('/dashboard');
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to create account. Please try again.';
    console.error('Signup error:', err);
  } finally {
    loading.value = false;
  }
};
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

.signup-card {
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

.signup-form {
  max-width: 100%;
}
</style>
