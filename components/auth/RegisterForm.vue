<template>
  <v-card
    class="glass-card pa-6"
    width="450"
    elevation="10"
    data-cy="register-form"
    data-testid="register-form"
  >
    <v-card-title class="text-h5 text-white text-center">Create Account</v-card-title>

    <v-form ref="form" validate-on="submit lazy" @submit.prevent="handleRegister">

      <v-alert
        v-if="register.error"
        type="error"
        class="mb-4"
        border="start"
        prominent
      >
        {{ register.error }}
      </v-alert>
      <v-alert
        v-if="register.success"
        type="success"
        class="mb-4"
        border="start"
        prominent
      >
        {{ register.success }}
      </v-alert>

      <v-text-field
        v-model="register.name"
        label="Full Name"
        prepend-icon="mdi-account"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required]"
        :disabled="register.loading"
        data-cy="fullname-input"
        data-testid="fullname-input"
        type="text"
      />

      <v-text-field
        v-model="register.email"
        label="Email"
        placeholder="you@example.com"
        prepend-icon="mdi-email-outline"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required, rules.email]"
        :disabled="register.loading"
        data-cy="email-input"
        data-testid="email-input"
        type="email"
      />

      <v-text-field
        v-model="register.password"
        :type="showPassword ? 'text' : 'password'"
        label="Password"
        prepend-icon="mdi-lock-outline"
        :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required, rules.password]"
        :disabled="register.loading"
        data-cy="password-input"
        data-testid="password-input"
        @click:append="showPassword = !showPassword"
      />

      <v-text-field
        v-model="register.confirmPassword"
        :type="showConfirmPassword ? 'text' : 'password'"
        label="Confirm Password"
        prepend-icon="mdi-lock-check"
        :append-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required, rules.confirmPassword]"
        :disabled="register.loading"
        data-cy="confirm-password-input"
        data-testid="confirm-password-input"
        @click:append="showConfirmPassword = !showConfirmPassword"
      />

      <v-checkbox
        v-model="register.agreeTerms"
        color="blue"
        class="text-white mb-2"
        :disabled="register.loading"
        :rules="[rules.agreeTerms]"
      >
        <template #label>
          <span class="text-white">
            I agree to the
            <a href="/terms" target="_blank" class="text-blue-300">Terms of Service</a>
            and
            <a href="/privacy" target="_blank" class="text-blue-300">Privacy Policy</a>
          </span>
        </template>
      </v-checkbox>

      <v-btn
        type="submit"
        block
        color="blue"
        class="mt-4 create-account-btn"
        :loading="register.loading"
        :disabled="register.loading || !register.agreeTerms"
        size="large"
        elevation="2"
        data-cy="create-account-button"
        data-testid="create-account-button"
        @click="handleButtonClick"
      >
        <v-icon left>mdi-account-plus</v-icon>
        Create Account
      </v-btn>

      <!-- Debug info (remove in production) -->
      <div v-if="isDevelopment" class="mt-2 text-caption text-white">
        <div>Debug: loading = {{ register.loading }}</div>
        <div>Debug: agreeTerms = {{ register.agreeTerms }}</div>
        <div>Debug: Button enabled = {{ !register.loading && register.agreeTerms }}</div>
      </div>
    </v-form>

    <div class="text-center mt-4">
      <NuxtLink to="/auth" class="text-blue-300 hover:text-blue-100">
        <v-icon left size="18">mdi-arrow-left</v-icon>
        Already have an account? Sign In
      </NuxtLink>
    </div>
  </v-card>
</template>

<script setup lang="ts">

import { navigateTo } from '#app';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useFormsStore } from '~/stores/formsStore';
import { useAuthStore } from '~/stores/authStore';

const isDevelopment = computed(() => process.env.NODE_ENV === 'development');
const form = ref(null);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

const formsStore = useFormsStore();
const authStore = useAuthStore();
const { register } = storeToRefs(formsStore);

function handleButtonClick(_event: Event) {
  if (!register.value.agreeTerms) {
    register.value.error = 'Please agree to the Terms of Service and Privacy Policy to continue.';
  }
  if (register.value.loading) {
    return;
  }
}

// Validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
  email: (v: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(v) || 'Please enter a valid email address';
  },
  password: (v: string) => {
    if (!v) return 'Password is required';
    if (v.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])/.test(v)) return 'Password must contain at least one lowercase letter';
    if (!/(?=.*[A-Z])/.test(v)) return 'Password must contain at least one uppercase letter';
    if (!/(?=.*\d)/.test(v)) return 'Password must contain at least one number';
    return true;
  },
  confirmPassword: (v: string) => {
    if (!v) return 'Please confirm your password';
    if (v !== register.value.password) return 'Passwords do not match';
    return true;
  },
  agreeTerms: (v: boolean) => {
    return v === true || 'You must agree to the Terms of Service and Privacy Policy';
  },
};

// Handle registration
async function handleRegister() {
  register.value.error = null;
  register.value.loading = true;

  try {

    // Check basic field requirements first
    if (!register.value.name?.trim()) {
      throw new Error('Full name is required');
    }
    if (!register.value.email?.trim()) {
      throw new Error('Email is required');
    }
    if (!register.value.password) {
      throw new Error('Password is required');
    }
    if (!register.value.confirmPassword) {
      throw new Error('Password confirmation is required');
    }
    if (register.value.password !== register.value.confirmPassword) {
      throw new Error('Passwords do not match');
    }
    if (!register.value.agreeTerms) {
      throw new Error('Please agree to the Terms of Service and Privacy Policy');
    }

    // Validate form with Vuetify

    if (form.value) {
      const formElement = form.value as { validate: () => Promise<{ valid: boolean }> };
      const { valid } = await formElement.validate();
      if (!valid) {
        throw new Error('Please fix the form validation errors and try again');
      }
    }

    // Use the auth store for registration
    const result = await authStore.signUp(register.value.email, register.value.password, {
      full_name: register.value.name,
    });

    if (!result.success) {
      throw new Error(result.error || 'Registration failed');
    }

    // Check if email verification is required
    if (result.requiresEmailVerification) {
      register.value.success = 'Registration successful! Please check your email to confirm your account before logging in.';
    } else {
      register.value.success = 'Registration successful! You can now log in with your credentials.';
    }

    // Clear form
    register.value.name = '';
    register.value.email = '';
    register.value.password = '';
    register.value.confirmPassword = '';
    register.value.agreeTerms = false;

    // Redirect to login page after a delay
    setTimeout(() => {
      navigateTo('/auth');
    }, 3000);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Registration failed';
    register.value.error = errorMessage;
    register.value.password = '';
    register.value.confirmPassword = '';
  } finally {
    register.value.loading = false;
  }
}
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-input input {
  color: #fff !important;
  text-shadow:
    0 1px 6px rgba(30, 30, 60, 0.45),
    0 0px 1px #000;
  letter-spacing: 0.02em;
  padding-left: 12px !important;
  padding-right: 12px !important;
  font-size: 1.08rem;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  background: rgba(255, 255, 255, 0.1) !important;
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

.text-blue-300 {
  color: #93c5fd;
  text-decoration: none;
}

.text-blue-300:hover {
  color: #dbeafe;
  text-decoration: underline;
}

.v-btn {
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.v-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

/* Create Account Button Styling */
.create-account-btn {
  position: relative;
  z-index: 10;
  cursor: pointer !important;
  pointer-events: auto !important;
  user-select: none;
  transition: all 0.3s ease;
}

.create-account-btn:not(.v-btn--disabled) {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%) !important;
  color: white !important;
  font-weight: 600 !important;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 15px rgba(33, 150, 243, 0.3) !important;
}

.create-account-btn:not(.v-btn--disabled):hover {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%) !important;
  box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4) !important;
  transform: translateY(-2px);
}

.create-account-btn:not(.v-btn--disabled):active {
  transform: translateY(0px);
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3) !important;
}

.create-account-btn.v-btn--disabled {
  background: rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.5) !important;
  cursor: not-allowed !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .glass-card {
    width: 100%;
    max-width: 360px;
    border-radius: 18px;
  }

  .glass-input input {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .glass-card {
    max-width: 320px;
    border-radius: 16px;
  }
}
</style>
