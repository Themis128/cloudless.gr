<template>
  <v-container fluid fill-height class="auth-container d-flex justify-center align-center">
    <div class="auth-wrapper">
      <LoginForm />
    </div>
  </v-container>
</template>


<script setup lang="ts">
import LoginForm from '~/components/auth/LoginForm.vue'
</script>

<style scoped>
/* Glass input styling */
.glass-input {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.glass-input :deep(.v-field) {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(2px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-input :deep(.v-field__input) {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
  letter-spacing: 0.02em;
  padding-left: 12px !important;
  padding-right: 12px !important;
  font-size: 1.08rem;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}

.glass-input :deep(.v-field__overlay) {
  background: transparent !important;
}

.glass-input :deep(.v-label) {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
}

.glass-input :deep(.v-field__prepend-inner .v-icon),
.glass-input :deep(.v-field__append-inner .v-icon) {
  color: rgba(255, 255, 255, 0.8) !important;
}

/* Sign in button */
.signin-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  backdrop-filter: blur(10px);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: none;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.signin-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

.signin-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}

/* Link styling */
.text-blue-300 {
  color: #93c5fd !important;
  transition: color 0.2s ease;
}

.text-blue-300:hover {
  color: #dbeafe !important;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .auth-container {
    padding: 12px;
  }
  
  .glass-card {
    border-radius: 12px;
    max-width: 100%;
  }
  
  .glass-card :deep(.v-card-title) {
    font-size: 1.5rem !important;
  }
  
  .glass-card :deep(.v-card-subtitle) {
    font-size: 0.9rem !important;
  }
  
  .glass-input :deep(.v-field__input) {
    font-size: 1rem;
    padding-left: 10px !important;
    padding-right: 10px !important;
  }
  
  .signin-btn {
    font-size: 1rem;
    min-height: 48px;
  }
}

@media (max-width: 360px) {
  .glass-card {
    border-radius: 8px;
  }
}
</style>
