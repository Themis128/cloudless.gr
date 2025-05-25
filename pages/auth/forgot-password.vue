<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>Forgot Password</h1>
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

      <form v-if="!successMessage" @submit.prevent="handleForgotPassword" class="auth-form">
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

        <button type="submit" class="auth-button" :disabled="isLoading">
          {{ isLoading ? 'Sending...' : 'Send Reset Link' }}
        </button>
      </form>

      <div class="auth-links">
        <p>Remembered your password? <NuxtLink to="/auth/login">Log in</NuxtLink></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Form state
const email = ref<string>('');
const error = ref<string>('');
const successMessage = ref<string>('');
const isLoading = ref<boolean>(false);

// Handle forgot password form submission
const handleForgotPassword = async (): Promise<void> => {
  isLoading.value = true;
  error.value = '';
  
  try {
    // In a real app, you would call an API to initiate password reset
    // This is a simulated response
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    
    // Show success message
    successMessage.value = 'Password reset instructions have been sent to your email.';
  } catch (err) {
    error.value = 'Failed to send password reset email. Please try again.';
    console.error('Error sending reset email:', err);
  } finally {
    isLoading.value = false;
  }
};

// Set page meta
definePageMeta({
  layout: 'default'
});
</script>

<style scoped>
.auth-container {
  min-height: 90vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
}

.auth-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  width: 100%;
  max-width: 450px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

h1 {
  color: #1e40af;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  font-weight: 700;
  text-align: center;
}

.error-message {
  background-color: #fee2e2;
  color: #b91c1c;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.success-message {
  background-color: #d1fae5;
  color: #065f46;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  color: #374151;
}

input {
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 1rem;
  transition: all 0.2s;
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  font-size: 1rem;
}

.auth-button:hover:not(:disabled) {
  background-color: #1e3a8a;
}

.auth-button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.auth-links {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: #4b5563;
}

.auth-links a {
  color: #1e40af;
  text-decoration: none;
  font-weight: 500;
}

.auth-links a:hover {
  text-decoration: underline;
}
</style>
