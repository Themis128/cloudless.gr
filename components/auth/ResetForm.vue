<template>
  <v-card class="glass-card pa-6" width="400" elevation="10">
    <v-card-title class="text-h5 text-white text-center">Reset Password</v-card-title>
    <v-form @submit.prevent="handleReset">      <v-alert
                                                  v-if="error"
                                                  type="error"
                                                  class="mb-4"
                                                  border="start"
                                                  prominent
                                                >
                                                  {{ error }}
                                                </v-alert>      <v-alert
                                                  v-if="success"
                                                  type="success"
                                                  class="mb-4"
                                                  border="start"
                                                  prominent
                                                >
                                                  Password reset link sent! Check your email for instructions. The link will expire in 1 hour.
                                                </v-alert><v-text-field
        v-model="email"
        label="Email"
        placeholder="you@example.com"
        prepend-icon="mdi-email-outline"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required, rules.email]"
      />
      <v-btn
        type="submit"
        block
        color="blue"
        class="mt-4"
        :loading="loading"
        :disabled="loading"
      >
        Send Reset Link
      </v-btn>
    </v-form>
    <NuxtLink to="/auth/login" class="login-link mt-4">
      <v-icon left size="18" color="#3b82f6">mdi-login</v-icon>
      <span>Already have an account? <span class="gradient-text">Login</span></span>
    </NuxtLink>
  </v-card>
</template>

<script setup lang="ts">

import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { useAuthStore } from '~/stores/authStore';

const authStore = useAuthStore();
const { loading, error } = storeToRefs(authStore);
const success = ref(false);
const email = ref('');

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email',
};

async function handleReset() {
  const result = await authStore.sendPasswordReset(email.value);
  if (result.success) {
    success.value = true;
    email.value = '';
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
.login-link {
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
.login-link:hover {
  color: #a855f7;
}
.gradient-text {
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}
</style>
