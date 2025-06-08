<template>
  <div class="login-page">
    <h1>Login</h1>

    <form @submit.prevent="login">
      <div>
        <label for="email">Email:</label>
        <input v-model="email" type="email" id="email" required />
      </div>

      <div>
        <label for="password">Password:</label>
        <input v-model="password" type="password" id="password" required />
      </div>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Logging in...' : 'Login' }}
      </button>

      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo, useRoute } from '#app'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const route = useRoute()

async function login() {
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/auth/supabase-login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value
      }
    })

    if (response.authenticated) {
      // ✅ Redirect to intended destination or fallback to dashboard
      await navigateTo(route.query.redirect?.toString() || '/dashboard')
    } else {
      error.value = 'Login failed. Please check your credentials.'
    }
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'An error occurred during login.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}

h1 {
  margin-bottom: 30px;
  font-size: 2rem;
  color: #333;
}

form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 400px;
}

div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-weight: 600;
  color: #555;
}

input {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
}

input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

button {
  padding: 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.error {
  color: #dc3545;
  margin-top: 10px;
  text-align: center;
}
</style>
