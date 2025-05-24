<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>Login</h1>
      <p v-if="loginError" class="error-message">{{ loginError }}</p>

      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            v-model="email"
            required
            placeholder="Enter your email"
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            v-model="password"
            required
            placeholder="Enter your password"
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="auth-button" :disabled="isLoading">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>

      <div class="auth-links">
        <p>Don't have an account? <NuxtLink to="/auth/signup">Sign up</NuxtLink></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useUserAuth } from '~/composables/useUserAuth';

const { login, loginError, isLoading, isLoggedIn } = useUserAuth();

// Form state
const email = ref('');
const password = ref('');
const route = useRoute();

// Get redirect path from query parameter or default to dashboard
const redirectPath = computed(() => {
  return route.query.redirect ? String(route.query.redirect) : '/dashboard';
});

// Redirect if already logged in
if (process.client && isLoggedIn.value) {
  navigateTo(redirectPath.value);
}

// Handle login form submission
const handleLogin = async () => {
  if (await login(email.value, password.value)) {
    // Redirect to original destination or dashboard if login successful
    navigateTo(redirectPath.value);
  }
};
</script>

<style scoped>
.auth-container {
  min-height: 90vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
}

.auth-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

h1 {
  color: #1e40af;
  font-size: 1.8rem;
  text-align: center;
  margin-bottom: 1.5rem;
  font-weight: 700;
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  color: rgb(185, 28, 28);
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  text-align: center;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
}

input {
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #cbd5e1;
  background-color: white;
  font-size: 1rem;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.auth-button {
  background-color: #1e40af;
  color: white;
  font-weight: 600;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 0.75rem;
}

.auth-button:hover {
  background-color: #1e3a8a;
}

.auth-button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.auth-links {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
}

.auth-links a {
  color: #2563eb;
  font-weight: 500;
  text-decoration: none;
}

.auth-links a:hover {
  text-decoration: underline;
}
</style>
