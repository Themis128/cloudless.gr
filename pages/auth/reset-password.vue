<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>Reset Password</h1>
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

      <form v-if="!successMessage" @submit.prevent="handleResetPassword" class="auth-form">
        <div class="form-group">
          <label for="password">New Password</label>
          <input
            type="password"
            id="password"
            v-model="password"
            required
            placeholder="Enter new password"
            autocomplete="new-password"
            minlength="6"
          />
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input
            type="password"
            id="confirmPassword"
            v-model="confirmPassword"
            required
            placeholder="Confirm new password"
            autocomplete="new-password"
            minlength="6"
          />
        </div>

        <button type="submit" class="auth-button" :disabled="isLoading">
          {{ isLoading ? 'Updating...' : 'Reset Password' }}
        </button>
      </form>

      <div v-if="successMessage" class="auth-links">
        <NuxtLink to="/auth/login" class="login-link">Go to Login</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, definePageMeta } from '#imports'

// Form state
const password = ref<string>('');
const confirmPassword = ref<string>('');
const token = ref<string>('');
const error = ref<string>('');
const successMessage = ref<string>('');
const isLoading = ref<boolean>(false);
const isValidToken = ref<boolean>(true);

// Get token from URL
onMounted(() => {
  const route = useRoute();
  token.value = route.query.token as string || '';
  
  // Validate token (in a real app this would verify the token with an API)
  if (!token.value) {
    error.value = 'Invalid or expired reset token. Please request a new password reset link.';
    isValidToken.value = false;
  }
});

// Handle reset password form submission
const handleResetPassword = async (): Promise<void> => {
  // Validate passwords match
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    return;
  }
  
  // Validate password length
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters long';
    return;
  }
  
  isLoading.value = true;
  error.value = '';
  
  try {
    // In a real app, you would call an API to reset password using token
    // This is a simulated response
    await new Promise<void>(resolve => setTimeout(resolve, 1500));
    
    // Show success message
    successMessage.value = 'Your password has been reset successfully. You can now log in with your new password.';
  } catch (err) {
    error.value = 'Failed to reset password. The link may be expired or invalid.';
    console.error('Error resetting password:', err);
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
}

.login-link {
  display: inline-block;
  background-color: #1e40af;
  color: white;
  text-decoration: none;
  padding: 0.75rem 2rem;
  border-radius: 0.375rem;
  font-weight: 600;
  transition: background-color 0.2s;
}

.login-link:hover {
  background-color: #1e3a8a;
}
</style>
