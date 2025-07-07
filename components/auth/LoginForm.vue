<template>
  <v-card class="glass-card pa-8 ma-4">
    <v-card-title class="text-center text-h5 font-weight-bold mb-4">
      <v-icon class="mr-2">mdi-account-circle</v-icon>
      Welcome Back
    </v-card-title>
    
    <v-card-subtitle class="text-center mb-4">
      Sign in to your Cloudless.gr account
    </v-card-subtitle>

    <v-form
      ref="form"
      v-model="isFormValid"
      lazy-validation
      @submit.prevent="handleLogin"
    >
      <v-text-field
        v-model="login.email"
        :rules="rules.email"
        label="Email"
        type="email"
        prepend-inner-icon="mdi-email"
        variant="outlined"
        :disabled="login.loading"
        class="mb-2"
        autocomplete="email"
        required
      />

      <v-text-field
        v-model="login.password"
        :rules="rules.password"
        label="Password"
        type="password"
        prepend-inner-icon="mdi-lock"
        variant="outlined"
        :disabled="login.loading"
        class="mb-4"
        autocomplete="current-password"
        required
      />

      <v-alert
        v-if="login.error"
        type="error"
        variant="outlined"
        class="mb-4"
        closable
        @click:close="login.error = null"
      >
        {{ login.error }}
      </v-alert>

      <v-alert
        v-if="debugInfo"
        type="info"
        variant="outlined"
        class="mb-4"
        density="compact"
      >
        {{ debugInfo }}
      </v-alert>

      <v-btn
        type="submit"
        color="primary"
        size="large"
        block
        :loading="login.loading"
        :disabled="!isFormValid || login.loading"
        class="mb-4"
      >
        <v-icon class="mr-2">mdi-login</v-icon>
        Sign In
      </v-btn>
    </v-form>

    <div class="text-center">
      <p class="text-body-2 text-grey-darken-1">
        Don't have an account?
        <a
          href="/auth/register"
          class="text-primary text-decoration-none font-weight-medium"
        >
          Sign up here
        </a>
      </p>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { setRecentLogin } from '@/utils/authFlags';

const emit = defineEmits<{
  success: [void];
}>();

const authStore = useAuthStore();
const form = ref();
const debugInfo = ref('');

const login = ref({
  email: '',
  password: '',
  error: null as string | null,
  loading: false
});

const isValidEmail = (email: string) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

const rules = {
  email: [
    (v: string) => !!v || 'Email is required',
    (v: string) => isValidEmail(v) || 'Email must be valid'
  ],
  password: [
    (v: string) => !!v || 'Password is required',
    (v: string) => v.length >= 6 || 'Password must be at least 6 characters'
  ]
};

const isFormValid = ref(false);

async function handleLogin() {
  debugInfo.value = '';
  login.value.error = null;
  login.value.loading = true;

  try {
    console.log('Starting login process...');
    debugInfo.value = 'Validating form...';

    // Simple validation without hanging Vuetify validate() call
    if (!login.value.email?.trim()) {
      throw new Error('Email is required');
    }
    if (!isValidEmail(login.value.email)) {
      throw new Error('Please enter a valid email address');
    }
    if (!login.value.password) {
      throw new Error('Password is required');
    }
    if (login.value.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    console.log('Attempting login with:', login.value.email);
    debugInfo.value = 'Authenticating...';
    const result = await authStore.signIn(login.value.email, login.value.password);
    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }
    console.log('Login successful:', result.user?.email);
    debugInfo.value = 'Login successful, redirecting...';
    
    // Set recent login flag to help middleware allow immediate access
    setRecentLogin();
    
    // Clear form on success
    login.value.email = '';
    login.value.password = '';

    // Show success message briefly, then emit success event
    console.log('Authentication successful, emitting success...');
    
    // Emit success event to parent component for handling redirect
    setTimeout(() => {
      console.log('Emitting success event to parent...');
      emit('success');
      debugInfo.value = 'Navigation handled by parent component...';
      
      // Also try direct navigation as backup after a delay
      setTimeout(async () => {
        try {
          console.log('Attempting direct navigation as backup...');
          const currentPath = window.location.pathname;
          const targetPath = '/users/index';
          
          if (currentPath !== targetPath) {
            console.log('Current path:', currentPath, '→ Target path:', targetPath);
            window.location.href = targetPath;
          } else {
            console.log('Already at target path:', targetPath);
          }
        } catch (directNavError) {
          console.error('Direct navigation failed:', directNavError);
        }
      }, 1000); // Give parent component time to handle first
    }, 300); // Short delay to ensure auth state is updated
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
  width: 100%;
  max-width: 400px;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .glass-card {
    margin: 0;
    border-radius: 12px;
    max-width: 100%;
  }
  
  .glass-card .v-card-title {
    font-size: 1.5rem !important;
  }
}

/* Field enhancements for glass card */
.glass-card :deep(.v-field) {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.glass-card :deep(.v-field--focused) {
  background: rgba(255, 255, 255, 0.15);
}

.glass-card :deep(.v-btn--variant-elevated) {
  backdrop-filter: blur(8px);
  background: rgba(var(--v-theme-primary), 0.9);
}

.glass-card :deep(.v-btn--variant-elevated:hover) {
  background: rgba(var(--v-theme-primary), 1);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(var(--v-theme-primary), 0.3);
}
</style>
