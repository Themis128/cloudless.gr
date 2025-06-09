<template>
  <v-row justify="center" align="center" class="fill-height">
    <v-col cols="12" sm="8" md="6" lg="4">
      <v-card class="pa-6 elevation-12 auth-card" rounded="xl">
        <!-- Logo and Title -->
        <div class="text-center mb-4">
          <v-img src="/logo.png" alt="Cloudless Logo" width="64" class="mx-auto mb-4" />
          <h1 class="text-h4 font-weight-bold text-white mb-2">Welcome Back</h1>
          <p class="text-body-1 text-medium-emphasis">Enter your credentials to continue</p>
        </div>

        <!-- Error Alert -->
        <v-slide-y-transition>
          <v-alert
            v-if="error || loginError"
            type="error"
            variant="tonal"
            closable
            class="mb-4"
            border="start"
            elevation="2"
          >
            {{ error || loginError }}
            <template v-if="showResendButton">
              <v-btn
                color="error"
                variant="text"
                class="mt-2"
                block
                @click="handleResendVerification"
              >
                Resend Verification Email
              </v-btn>
            </template>
          </v-alert>
        </v-slide-y-transition>

        <v-form ref="form" @submit.prevent="handleLogin" validate-on="input">
          <v-card-text>
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
              class="mb-2"
              :loading="isLoading"
              :disabled="isLoading || isRateLimited"
              :error-messages="emailError"
              @keyup.enter="focusPassword"
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
              class="mb-4"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showPassword = !showPassword"
              :type="showPassword ? 'text' : 'password'"
              :loading="isLoading"
              :disabled="isLoading || isRateLimited"
              :error-messages="passwordError"
              @keyup.enter="handleLogin"
            />
            <!-- Remember Me and Forgot Password -->
            <div class="d-flex justify-space-between align-center mb-6">
              <v-checkbox
                v-model="rememberMe"
                label="Remember me"
                color="primary"
                hide-details
                :disabled="isLoading || isRateLimited"
              />
              <v-btn
                variant="text"
                color="primary"
                to="/auth/forgot-password"
                size="small"
                class="text-caption"
                :disabled="isLoading || isRateLimited"
              >
                Forgot Password?
              </v-btn>
            </div>
          </v-card-text>

          <v-card-actions class="px-4 pb-6">
            <v-btn
              type="submit"
              color="primary"
              size="x-large"
              block
              :loading="isLoading"
              :disabled="isLoading || !formIsValid || isRateLimited"
              elevation="4"
              class="text-subtitle-1"
            >
              <v-icon start icon="mdi-login" class="mr-2" />
              {{ isLoading ? 'Signing in...' : 'Sign In to Dashboard' }}
            </v-btn>
          </v-card-actions>
        </v-form>

        <!-- Divider with text -->
        <div class="position-relative my-8">
          <v-divider />
          <span
            class="text-body-2 position-absolute top-50 start-50 translate-middle px-4 bg-surface"
          >
            or
          </span>
        </div>

        <!-- Social Login Buttons -->
        <div class="px-4 mb-6">
          <v-btn
            block
            variant="outlined"
            class="mb-3"
            color="primary"
            height="44"
            :loading="socialLoading.google"
            :disabled="isLoading || isRateLimited"
            @click="signInWithProvider('google')"
          >
            <v-icon start icon="mdi-google" class="mr-2" />
            {{ socialLoading.google ? 'Connecting...' : 'Continue with Google' }}
          </v-btn>
          <v-btn
            block
            variant="outlined"
            color="primary"
            height="44"
            :loading="socialLoading.github"
            :disabled="isLoading || isRateLimited"
            @click="signInWithProvider('github')"
          >
            <v-icon start icon="mdi-github" class="mr-2" />
            {{ socialLoading.github ? 'Connecting...' : 'Continue with GitHub' }}
          </v-btn>
        </div>

        <!-- Sign Up Link -->
        <div class="text-center pa-4">
          <span class="text-body-2">Don't have an account?</span>
          <v-btn
            variant="text"
            color="primary"
            to="/auth/signup"
            class="ml-2 text-subtitle-2 font-weight-medium"
            :disabled="isLoading || isRateLimited"
          >
            Sign up
          </v-btn>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
  // Import from #imports instead of vue directly
  import { computed, ref, watch } from '#imports';
  import { useSupabaseAuth } from '~/composables/useSupabaseAuth';
  // Types
  type ErrorType = string | null;
  type Provider = 'google' | 'github';

  // Composables
  const route = useRoute();
  const router = useRouter();
  const {
    signIn,
    signInWithOAuth,
    sendVerificationEmail,
    loading: isLoading,
    error: loginError,
  } = useSupabaseAuth();
  const toast = useToast();

  // Form refs
  const form = ref<HTMLFormElement>();
  const email = ref<string>('');
  const password = ref<string>('');
  const passwordField = ref<HTMLElement>();
  const showPassword = ref<boolean>(false);
  const rememberMe = ref<boolean>(false);

  // State refs
  const error = ref<ErrorType>(null);
  const emailError = ref<string>('');
  const passwordError = ref<string>('');
  const socialLoading = ref<{ [key in Provider]: boolean }>({
    google: false,
    github: false,
  });
  const loginAttempts = ref<number>(0);
  const lastLoginAttempt = ref<number>(0);
  const showResendButton = ref<boolean>(false);

  // Constants
  const MAX_LOGIN_ATTEMPTS = 5;
  const COOLDOWN_PERIOD = 15 * 60 * 1000; // 15 minutes in milliseconds

  // Enhanced validation rules
  const emailRules = [
    (v: string) => !!v || 'Email is required',
    (v: string) => /.+@.+\..+/.test(v) || 'Email must be a valid address',
    (v: string) => v.length <= 255 || 'Email must not exceed 255 characters',
  ];

  const passwordRules = [
    (v: string) => !!v || 'Password is required',
    (v: string) => v.length >= 8 || 'Password must be at least 8 characters',
    (v: string) => /[A-Z]/.test(v) || 'Password must contain one uppercase letter',
    (v: string) => /[a-z]/.test(v) || 'Password must contain one lowercase letter',
    (v: string) => /[0-9]/.test(v) || 'Password must contain one number',
    (v: string) => /[^A-Za-z0-9]/.test(v) || 'Password must contain one special character',
  ];

  // Computed properties for better reactivity
  const formIsValid = computed(() => {
    return (
      email.value &&
      password.value &&
      !emailError.value &&
      !passwordError.value &&
      /.+@.+\..+/.test(email.value) && // Basic email validation
      password.value.length >= 8
    ); // Basic password validation
  });

  const isRateLimited = computed(() => {
    if (loginAttempts.value >= MAX_LOGIN_ATTEMPTS) {
      const timeElapsed = Date.now() - lastLoginAttempt.value;
      return timeElapsed < COOLDOWN_PERIOD;
    }
    return false;
  });

  // Methods
  const focusPassword = () => {
    passwordField.value?.$el.querySelector('input').focus();
  };

  const clearErrors = () => {
    error.value = null;
    emailError.value = '';
    passwordError.value = '';
    showResendButton.value = false;
  };

  const updateLoginAttempts = () => {
    loginAttempts.value++;
    lastLoginAttempt.value = Date.now();
    if (loginAttempts.value >= MAX_LOGIN_ATTEMPTS) {
      const remainingTime = Math.ceil(
        (COOLDOWN_PERIOD - (Date.now() - lastLoginAttempt.value)) / 60000
      );
      error.value = `Too many login attempts. Please try again in ${remainingTime} minutes.`;
    }
  };

  const handleResendVerification = async () => {
    try {
      await sendVerificationEmail(email.value);
      toast.success('Verification email sent! Please check your inbox.');
      showResendButton.value = false;
    } catch (err: any) {
      console.error('Error sending verification email:', err);
      toast.error('Failed to send verification email. Please try again.');
    }
  };

  const handleLogin = async (): Promise<void> => {
    clearErrors();

    // Check rate limiting
    if (isRateLimited.value) {
      const remainingTime = Math.ceil(
        (COOLDOWN_PERIOD - (Date.now() - lastLoginAttempt.value)) / 60000
      );
      error.value = `Too many login attempts. Please try again in ${remainingTime} minutes.`;
      return;
    }

    // Validate form before submission
    const { valid } = (await form.value?.validate()) ?? { valid: false };
    if (!valid) {
      error.value = 'Please fix the form errors before submitting.';
      return;
    }

    try {
      await signIn(email.value, password.value);

      // If no error and we have a redirect, go there
      if (!loginError.value) {
        // Handle remember me
        if (rememberMe.value) {
          localStorage.setItem('rememberMe', 'true');
          localStorage.setItem('lastEmail', email.value);
          localStorage.setItem('lastLoginAt', new Date().toISOString());
        } else {
          localStorage.removeItem('rememberMe');
          localStorage.removeItem('lastEmail');
          localStorage.removeItem('lastLoginAt');
        }

        // Reset login attempts on successful login
        loginAttempts.value = 0;
        lastLoginAttempt.value = 0;

        // Show success message and redirect
        const redirectTo = route.query.redirectTo?.toString() || '/dashboard';
        toast.success('Successfully logged in!');
        await router.push(redirectTo);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      updateLoginAttempts();

      if (err?.message?.includes('Invalid login credentials')) {
        error.value = 'Invalid email or password. Please try again.';
        passwordError.value = 'Incorrect password';
      } else if (err?.message?.includes('Rate limit')) {
        error.value = 'Too many login attempts. Please try again later.';
      } else if (err?.message?.includes('Email not confirmed')) {
        error.value = 'Please verify your email address before logging in.';
        emailError.value = 'Email not verified';
        showResendButton.value = true;
      } else {
        error.value = 'An error occurred while logging in. Please try again.';
      }

      // Always clear password on error
      password.value = '';
    }
  };

  const signInWithProvider = async (provider: Provider) => {
    clearErrors();
    socialLoading.value[provider] = true;

    try {
      await signInWithOAuth({ provider });
    } catch (err: any) {
      console.error(`${provider} login error:`, err);
      error.value = `Unable to sign in with ${provider}. Please try again.`;
      toast.error(`Failed to sign in with ${provider}. Please try again.`);
    } finally {
      socialLoading.value[provider] = false;
    }
  };

  // Load remembered email and check URL params
  onMounted(() => {
    if (localStorage.getItem('rememberMe') === 'true') {
      const rememberedEmail = localStorage.getItem('lastEmail');
      if (rememberedEmail) {
        email.value = rememberedEmail;
        rememberMe.value = true;
      }
    }

    // Check for error messages in URL (e.g., after OAuth redirect)
    const errorMsg = route.query.error?.toString();
    const successMsg = route.query.success?.toString();

    if (errorMsg) {
      error.value = decodeURIComponent(errorMsg);
      toast.error(error.value);
    } else if (successMsg) {
      toast.success(decodeURIComponent(successMsg));
    }
  });

  // Watch for form input to clear errors
  watch([email, password], () => {
    clearErrors();
  });

  // Set page meta
  definePageMeta({
    layout: 'auth',
    public: true,
  });
</script>

<style scoped>
  :deep(.v-text-field) {
    border-radius: 12px;
  }

  :deep(.v-text-field .v-field__input),
  :deep(.v-text-field .v-label),
  :deep(.text-body-2),
  :deep(.v-checkbox-label) {
    color: rgba(255, 255, 255, 0.9) !important;
  }

  :deep(.v-field) {
    border-radius: 12px !important;
    background: rgba(255, 255, 255, 0.12) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }

  :deep(.v-field--variant-outlined .v-field__outline) {
    --v-field-border-opacity: 0.15;
    border-width: 2px;
  }

  :deep(.v-field:hover .v-field__outline) {
    --v-field-border-opacity: 0.25;
  }

  :deep(.v-field--focused .v-field__outline) {
    --v-field-border-opacity: 0.35;
    border-width: 2px;
  }

  :deep(.v-btn:not(.v-btn--variant-text)) {
    background: linear-gradient(
      135deg,
      rgba(var(--v-theme-primary), 0.95),
      rgba(var(--v-theme-primary), 0.85)
    ) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    border-radius: 12px;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  :deep(.v-btn:not(.v-btn--variant-text):hover) {
    background: linear-gradient(
      135deg,
      rgba(var(--v-theme-primary), 1),
      rgba(var(--v-theme-primary), 0.9)
    ) !important;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  }

  :deep(.v-alert) {
    background: rgba(var(--v-theme-error), 0.12) !important;
    color: rgb(var(--v-theme-error)) !important;
    border: 2px solid rgba(var(--v-theme-error), 0.2);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 12px;
  }

  :deep(.v-divider) {
    border-color: rgba(255, 255, 255, 0.12) !important;
    margin: 24px 0;
  }

  /* Enhance icon visibility and transitions */
  :deep(.v-icon) {
    opacity: 0.9;
    transition: all 0.3s ease;
  }

  :deep(.v-btn:hover .v-icon) {
    transform: scale(1.1);
  }

  /* Card enhancement */
  :deep(.auth-card) {
    background: rgba(30, 30, 30, 0.7) !important;
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
  }

  /* Checkbox styling */
  :deep(.v-checkbox) {
    .v-selection-control {
      opacity: 0.9;
    }
    &:hover .v-selection-control {
      opacity: 1;
    }
  }
</style>
