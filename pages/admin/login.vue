<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Admin Login</h1>
      <p v-if="error" class="error-message">{{ error }}</p>

      <form @submit.prevent="login" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            type="text"
            id="username"
            v-model="username"
            required
            placeholder="Enter your username"
            autocomplete="username"
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

        <button type="submit" class="login-button" :disabled="isLoading">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// State management
const username = ref<string>('');
const password = ref<string>('');
const error = ref<string>('');
const isLoading = ref<boolean>(false);

// For demo purposes, hardcoded credentials
// In a real application, you would use a secure authentication system
const DEMO_USERNAME: string = 'admin';
const DEMO_PASSWORD: string = 'cloudless2025';

// Login function
const login = async (): Promise<void> => {
  isLoading.value = true;
  error.value = '';

  // Simple validation
  if (!username.value || !password.value) {
    error.value = 'Username and password are required';
    isLoading.value = false;
    return;
  }

  // Simulate API call
  setTimeout(() => {
    // Check credentials
    if (username.value === DEMO_USERNAME && password.value === DEMO_PASSWORD) {
      // Store authentication state in localStorage
      if (process.client) {
        localStorage.setItem('admin_authenticated', 'true');
      }

      // Redirect to admin dashboard
      navigateTo('/admin/contact-submissions');
    } else {
      error.value = 'Invalid username or password';
    }

    isLoading.value = false;
  }, 1000);
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background-color: #f8fafc;
}

.login-card {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 2rem;
  width: 100%;
  max-width: 400px;
}

.login-card h1 {
  color: #1e40af;
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.error-message {
  background-color: #fee2e2;
  color: #b91c1c;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  color: #374151;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.form-group input {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.login-button {
  background-color: #1e40af;
  color: white;
  font-weight: 500;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 1rem;
}

.login-button:hover:not(:disabled) {
  background-color: #1e3a8a;
}

.login-button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}
</style>
