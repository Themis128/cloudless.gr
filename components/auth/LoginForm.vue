<template>
  <v-card
    class="glass-card pa-6"
    width="400"
    elevation="10"
    data-cy="login-form"
    data-testid="login-form"
  >
    <v-card-title class="text-white text-center">Login</v-card-title>
    <v-form ref="form" validate-on="submit lazy" @submit.prevent="handleLogin">
      <v-alert
        v-if="login.error"
        type="error"
        class="mb-4"
        border="start"
        prominent
      >
        {{ login.error }}
      </v-alert>

      <v-text-field
        v-model="login.email"
        label="Email"
        placeholder="you@example.com"
        prepend-icon="mdi-email-outline"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required, rules.email]"
        :disabled="login.loading"
        data-cy="email-input"
        data-testid="email-input"
        type="email"
      />

      <v-text-field
        v-model="login.password"
        :type="showPassword ? 'text' : 'password'"
        label="Password"
        prepend-icon="mdi-lock-outline"
        :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input"
        :rules="[rules.required]"
        :disabled="login.loading"
        data-cy="password-input"
        data-testid="password-input"
        @click:append="showPassword = !showPassword"
      />

      <v-btn
        type="submit"
        block
        color="blue"
        class="mt-4"
        :loading="login.loading"
        :disabled="login.loading"
        data-cy="login-button"
        data-testid="login-button"
      >
        <v-icon left>mdi-login</v-icon> Login
      </v-btn>

      <v-btn
        variant="text"
        block
        color="white"
        class="mt-4"
        :disabled="login.loading"
        data-cy="forgot-password-button"
        data-testid="forgot-password-button"
        @click="navigateTo('/auth/reset')"
      >
        Forgot Password?
      </v-btn>

      <!-- Debug info (remove in production) -->
      <div v-if="debugInfo" class="mt-2 text-caption text-white">
        <div>Debug: {{ debugInfo }}</div>
      </div>
    </v-form>

    <NuxtLink to="/auth/register" class="register-link mt-4">
      <v-icon left size="18" color="#a855f7">mdi-account-plus</v-icon>
      <span>Don’t have an account? <span class="gradient-text">Register</span></span>
    </NuxtLink>
  </v-card>
</template>

<script setup lang="ts">

import { navigateTo } from '#app';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/authStore';
import { useFormsStore } from '~/stores/formsStore';

const form = ref(null);
const showPassword = ref(false);
const debugInfo = ref('');
const formsStore = useFormsStore();
const authStore = useAuthStore();
const { login } = storeToRefs(formsStore);

// Validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
  email: (v: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(v) || 'Please enter a valid email address';
  },
};

async function handleLogin() {
  debugInfo.value = '';
  login.value.error = null;
  login.value.loading = true;

  try {
    console.log('🔍 Starting login process...');
    debugInfo.value = 'Validating form...';

    // Validate form with Vuetify
    if (form.value) {
      const formElement = form.value as { validate: () => Promise<{ valid: boolean }> };
      const { valid } = await formElement.validate();
      if (!valid) {
        throw new Error('Please fix the form validation errors');
      }
    }
    // Check basic field requirements
    if (!login.value.email?.trim()) {
      throw new Error('Email is required');
    }
    if (!login.value.password) {
      throw new Error('Password is required');
    }    console.log('🔑 Attempting login with:', login.value.email);
    debugInfo.value = 'Authenticating...';
    const result = await authStore.signIn(login.value.email, login.value.password);
    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }
    console.log('✅ Login successful:', result.user?.email);
    debugInfo.value = 'Login successful, redirecting...';
    // Clear form on success
    login.value.email = '';
    login.value.password = '';    // Show success message briefly, then redirect
    setTimeout(async () => {
      try {
        // Always redirect to user dashboard first for successful authentication
        // Admin users can then navigate to admin areas from the user dashboard
        let targetRoute = '/users/';
        await navigateTo(targetRoute);
      } catch {
        await navigateTo('/users/');
      }
    }, 1500);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Login failed';
    login.value.error = errorMessage;
    debugInfo.value = `Error: ${errorMessage}`;
    login.value.password = '';
  } finally {
    login.value.loading = false;
  }
}
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.3);
}
.glass-input input {
  color: #fff !important;
  text-shadow:
    0 1px 6px rgba(30, 30, 60, 0.45),
    0 0px 1px #000;
  /* Fix tab/letter spacing and padding for better alignment */
  letter-spacing: 0.02em;
  padding-left: 12px !important;
  padding-right: 12px !important;
  font-size: 1.08rem;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  background: rgba(255, 255, 255, 0.1) !important; /* semi-transparent */
  backdrop-filter: blur(2px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.1);
}
.glass-input .v-field__overlay {
  background: transparent !important;
}
.v-label {
  color: #fff !important;
  text-shadow:
    0 1px 6px rgba(30, 30, 60, 0.45),
    0 0px 1px #000;
}
::placeholder {
  color: #f3f6fa !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.35);
  opacity: 1;
}
.register-link {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  font-weight: 500;
  color: #3b82f6;
  gap: 0.4em;
  text-decoration: none;
  transition: color 0.2s;
}
.register-link:hover {
  color: #a855f7;
}
.gradient-text {
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}
.glass-card .v-card-title,
.glass-card .v-card-subtitle,
.glass-card .v-btn,
.glass-card .v-list-item-title,
.glass-card .v-list-item-subtitle {
  color: #fff !important;
  text-shadow:
    0 1px 6px rgba(30, 30, 60, 0.45),
    0 0px 1px #000;
}
</style>
