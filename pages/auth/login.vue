<template>
  <div class="auth-wrapper">
    <v-card class="auth-card text-white" rounded="lg" elevation="8">
      <!-- Logo and Title -->
      <div class="text-center mb-8">
        <v-img
          src="/images/logo.svg"
          alt="Cloudless Logo"
          width="80"
          height="80"
          class="mx-auto mb-6"
        />
        <h1 class="text-h4 font-weight-bold mb-2 white-gradient-text">Welcome Back</h1>
        <p class="text-subtitle-1 text-white">Sign in to your account to continue</p>
      </div>

      <!-- Error Alert -->
      <v-slide-y-transition>
        <v-alert
          v-if="error || loginError"
          type="error"
          variant="tonal"
          closable
          class="mb-6 text-white"
          border="start"
          elevation="1"
          style="border-left-width: 4px"
        >
          {{ error || loginError }}
          <template v-if="showResendButton">
            <v-btn
              color="error"
              variant="text"
              class="mt-2 text-white"
              block
              @click="handleResendVerification"
            >
              <v-icon start icon="mdi-email-sync" class="mr-2" />
              Resend Verification Email
            </v-btn>
          </template>
        </v-alert>
      </v-slide-y-transition>

      <v-form ref="form" @submit.prevent="handleLogin">
        <v-card-text class="px-2">
          <!-- Email Field -->
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            required
            :rules="emailRules"
            prepend-inner-icon="mdi-email"
            variant="outlined"
            placeholder="Enter your email"
            autocomplete="email"
            class="mb-4 white-input"
            :loading="isLoading"
            :disabled="isLoading || isRateLimited"
            :error-messages="emailError"
            @keydown.enter.prevent="focusPassword"
            density="comfortable"
            bg-color="surface"
          />

          <!-- Password Field -->
          <v-text-field
            ref="passwordField"
            v-model="password"
            label="Password"
            required
            :rules="passwordRules"
            prepend-inner-icon="mdi-lock"
            variant="outlined"
            placeholder="Enter your password"
            autocomplete="current-password"
            class="mb-6 white-input"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            :type="showPassword ? 'text' : 'password'"
            :loading="isLoading"
            :disabled="isLoading || isRateLimited"
            :error-messages="passwordError"
            @keydown.enter.prevent="handleLogin"
            density="comfortable"
            bg-color="surface"
          />

          <!-- Remember Me and Forgot Password -->
          <div class="d-flex justify-space-between align-center mb-8">
            <v-checkbox
              v-model="rememberMe"
              label="Remember me"
              color="white"
              class="text-white"
              hide-details
              :disabled="isLoading || isRateLimited"
              density="comfortable"
            />
            <v-btn
              variant="text"
              color="white"
              to="/auth/forgot-password"
              class="text-body-2 font-weight-medium"
              :disabled="isLoading || isRateLimited"
              size="small"
            >
              <v-icon start icon="mdi-lock-reset" class="mr-1" />
              Forgot Password?
            </v-btn>
          </div>

          <!-- Submit Button -->
          <v-btn
            type="submit"
            variant="elevated"
            size="x-large"
            block
            :loading="isLoading"
            :disabled="isLoading || !formIsValid || isRateLimited"
            class="sign-in-btn text-subtitle-1 mb-4"
          >
            <v-icon start icon="mdi-login" class="mr-2" />
            {{ isLoading ? 'Signing in...' : 'Sign In' }}
          </v-btn>
        </v-card-text>
      </v-form>

      <!-- Divider with Sign Up -->
      <div class="divider-wrapper text-center my-6">
        <span class="divider-text text-white text-caption">Don't have an account?</span>
        <v-btn
          to="/auth/register"
          variant="text"
          color="white"
          class="mt-2"
          block
          :disabled="isLoading || isRateLimited"
        >
          Create an account
          <v-icon end icon="mdi-chevron-right" />
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  // Page meta
  definePageMeta({
    middleware: ['guest'],
    layout: 'auth',
    public: true,
  });

  // Form fields
  const email = ref('');
  const password = ref('');
  const rememberMe = ref(false);
  const showPassword = ref(false);

  // Form and field refs
  const form = ref<any>(null);
  const passwordField = ref<any>(null);

  // Loading and error states
  const isLoading = ref(false);
  const isRateLimited = ref(false);
  const error = ref<string | null>(null);
  const loginError = ref<string | null>(null);
  const emailError = ref<string | null>(null);
  const passwordError = ref<string | null>(null);
  const showResendButton = ref(false);

  // Form validation
  const formIsValid = ref(false);
  const emailRules = computed(() => [
    (v: string) => !!v || 'Email is required',
    (v: string) => /.+@.+\..+/.test(v) || 'Email must be valid',
  ]);

  const passwordRules = computed(() => [
    (v: string) => !!v || 'Password is required',
    (v: string) => (v && v.length >= 6) || 'Password must be at least 6 characters',
  ]);

  // Runtime context and utilities
  const route = useRoute();
  const supabase = useSupabaseClient();
  const { login, loginError: authError } = useUserAuth();

  // Clear all error messages
  const clearErrors = () => {
    error.value = null;
    loginError.value = null;
    emailError.value = null;
    passwordError.value = null;
    showResendButton.value = false;
  };

  // Watch for auth errors
  watch(
    () => authError,
    (newError: string) => {
      if (newError) {
        loginError.value = newError;
      }
    }
  );

  // Focus password field
  const focusPassword = () => {
    nextTick(() => {
      passwordField.value?.$el.querySelector('input')?.focus();
    });
  };

  // Form validation watcher
  watch([email, password], async () => {
    try {
      const { valid } = (await form.value?.validate()) || { valid: false };
      formIsValid.value = valid;
    } catch (error) {
      console.error('Validation error:', error);
      formIsValid.value = false;
    }
  });

  // Handle login
  const handleLogin = async () => {
    clearErrors();

    try {
      const { valid } = (await form.value?.validate()) || { valid: false };
      if (!valid) return;

      isLoading.value = true;

      // Attempt login
      const success = await login(email.value, password.value);

      if (!success) {
        throw new Error('Invalid email or password');
      }

      // Store remember me preference
      if (rememberMe.value) {
        localStorage.setItem('rememberMe', 'true');
      }

      // Navigate to dashboard or redirect URL
      const redirectTo = route.query.redirectTo?.toString() || '/dashboard';
      await navigateTo(redirectTo);
    } catch (e: any) {
      console.error('Login error:', e);

      if (e?.message?.includes('Email not verified')) {
        loginError.value = 'Please verify your email address';
        showResendButton.value = true;
      } else if (e?.message?.includes('Rate limit')) {
        isRateLimited.value = true;
        loginError.value = 'Too many attempts. Please try again later.';
      } else {
        loginError.value = e?.message || 'An error occurred during login';
      }
    } finally {
      isLoading.value = false;
    }
  };

  // Handle resend verification
  const handleResendVerification = async () => {
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.value,
      });

      if (resendError) throw resendError;

      showResendButton.value = false;
      loginError.value = 'Verification email sent! Please check your inbox.';
    } catch (e: any) {
      loginError.value = e?.message || 'Failed to resend verification email';
    }
  };
</script>

<style scoped>
  .auth-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.95) 100%);
  }

  .auth-card {
    width: 100%;
    max-width: 420px;
    padding: 2rem;
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .white-gradient-text {
    background: linear-gradient(45deg, #fff 30%, #f0f0f0 90%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .divider-wrapper {
    position: relative;
    margin: 2rem 0;
  }

  .sign-in-btn {
    min-height: 48px;
    text-transform: none;
    letter-spacing: 0.5px;
    background: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 255, 255, 0.85) 100%
    ) !important;
    color: rgba(0, 0, 0, 0.87) !important;
    border: none;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .sign-in-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 255, 255, 0.25);
  }

  .sign-in-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 10px rgba(255, 255, 255, 0.15);
  }

  .sign-in-btn:disabled {
    background: rgba(255, 255, 255, 0.3) !important;
    color: rgba(0, 0, 0, 0.4) !important;
    box-shadow: none;
    transform: none;
  }

  .sign-in-btn :deep(.v-icon) {
    color: rgba(0, 0, 0, 0.87) !important;
  }

  .sign-in-btn.v-btn--loading {
    background: rgba(255, 255, 255, 0.7) !important;
  }

  .divider-text {
    position: relative;
    z-index: 1;
    padding: 0 1rem;
  }

  .auth-form :deep(.v-field) {
    border-radius: 8px;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .auth-form :deep(.v-field--focused) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
  }

  .auth-form :deep(.v-field:hover) {
    transform: translateY(-1px);
  }

  .auth-form :deep(.v-label) {
    color: rgba(255, 255, 255, 0.87) !important;
  }

  .auth-form :deep(.v-field__input) {
    color: white !important;
  }

  .auth-form :deep(.v-icon) {
    color: rgba(255, 255, 255, 0.87) !important;
  }

  :deep(.v-messages) {
    color: rgba(255, 255, 255, 0.7) !important;
  }

  @media (max-width: 600px) {
    .auth-card {
      margin: 1rem;
      padding: 1.5rem;
    }
  }
</style>
