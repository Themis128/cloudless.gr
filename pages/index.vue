<template>
  <div class="index-container">
    <div class="welcome-card">
      <h1>Welcome to Cloudless</h1>
      <p>Please log in to access the application.</p>
      <div class="auth-buttons">
        <NuxtLink to="/auth/login" class="login-btn">
          Login
        </NuxtLink>
        <NuxtLink to="/auth/signup" class="signup-btn">
          Sign Up
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserAuth } from '~/composables/useUserAuth';
import { navigateTo } from '#app'

const { isLoggedIn } = useUserAuth();

// If user is already logged in, redirect to dashboard
if (process.client && isLoggedIn.value) {
  await navigateTo('/dashboard');
}
</script>

<style scoped>
.index-container {
  min-height: 90vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
}

.welcome-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 3rem 2rem;
  text-align: center;
  width: 100%;
  max-width: 500px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

h1 {
  color: #1e40af;
  font-size: 2.5rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

p {
  color: #64748b;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.auth-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.login-btn,
.signup-btn {
  padding: 0.75rem 2rem;
  border-radius: 0.375rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  min-width: 120px;
  text-align: center;
}

.login-btn {
  background-color: transparent;
  color: #1e40af;
  border: 2px solid #1e40af;
}

.login-btn:hover {
  background-color: #1e40af;
  color: white;
}

.signup-btn {
  background-color: #1e40af;
  color: white;
  border: 2px solid #1e40af;
}

.signup-btn:hover {
  background-color: #1e3a8a;
  border-color: #1e3a8a;
}

@media (max-width: 640px) {
  .welcome-card {
    padding: 2rem 1.5rem;
  }
  
  h1 {
    font-size: 2rem;
  }
  
  .auth-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .login-btn,
  .signup-btn {
    width: 100%;
    max-width: 200px;
  }
}
</style>
