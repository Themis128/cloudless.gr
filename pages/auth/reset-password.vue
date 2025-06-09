<template>
  <v-container fluid class="fill-height bg-surface">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-4 elevation-8">
          <v-card-title class="text-center text-h4 font-weight-bold pt-8 pb-4">
            Reset Password
          </v-card-title>

          <v-alert v-if="error" type="error" variant="tonal" closable class="mb-4">
            {{ error }}
          </v-alert>

          <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-4">
            {{ successMessage }}
          </v-alert>
          <v-form
            ref="form"
            v-if="!successMessage"
            @submit.prevent="handleResetPassword"
            validate-on="input"
          >
            <v-card-text>
              <p class="text-body-1 mb-4 text-center">Enter your new password below.</p>

              <v-text-field
                v-model="password"
                label="New Password"
                required
                :rules="passwordRules"
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                placeholder="Enter new password"
                autocomplete="new-password"
                class="mb-2"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showPassword = !showPassword"
                :type="showPassword ? 'text' : 'password'"
              ></v-text-field>

              <v-text-field
                v-model="confirmPassword"
                label="Confirm New Password"
                required
                :rules="confirmPasswordRules"
                prepend-inner-icon="mdi-lock-check"
                variant="outlined"
                placeholder="Confirm new password"
                autocomplete="new-password"
                class="mb-4"
                :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showConfirmPassword = !showConfirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
              ></v-text-field>
            </v-card-text>

            <v-card-actions class="px-4 pb-4">
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="isLoading"
                :disabled="isLoading"
              >
                {{ isLoading ? 'Updating...' : 'Reset Password' }}
              </v-btn>
            </v-card-actions>
          </v-form>

          <v-divider v-if="successMessage" class="mb-4"></v-divider>
          <div v-if="successMessage" class="text-center pb-4">
            <p class="text-body-1 mb-4">
              Redirecting to login in {{ redirectCountdown }} seconds...
            </p>
            <v-btn color="primary" to="/auth/login" size="large">Go to Login</v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, ref, watch } from '#imports';
  import { useSupabaseAuth } from '~/composables/useSupabaseAuth';

  // Types
  type ErrorType = string | null;

  // Composables
  const route = useRoute();
  const router = useRouter();
  const { updatePassword, loading: isLoading, error: authError } = useSupabaseAuth();

  // Form refs
  const form = ref<HTMLFormElement>();
  const password = ref<string>('');
  const confirmPassword = ref<string>('');
  const showPassword = ref<boolean>(false);
  const showConfirmPassword = ref<boolean>(false);

  // State refs
  const error = ref<ErrorType>(null);
  const successMessage = ref<string>('');
  const redirectCountdown = ref<number>(2);
  // Form validation rules
  const passwordRules = [
    (v: string) => !!v || 'Password is required',
    (v: string) => v.length >= 8 || 'Password must be at least 8 characters',
    (v: string) => /[A-Z]/.test(v) || 'Password must contain at least one uppercase letter',
    (v: string) => /[a-z]/.test(v) || 'Password must contain at least one lowercase letter',
    (v: string) => /[0-9]/.test(v) || 'Password must contain at least one number',
    (v: string) => /[^A-Za-z0-9]/.test(v) || 'Password must contain at least one special character',
  ];

  const confirmPasswordRules = [
    (v: string) => !!v || 'Please confirm your password',
    (v: string) => v === password.value || 'Passwords do not match',
  ];
  // Check if this is a reset password request and handle cleanup
  onMounted(() => {
    if (!route.hash.includes('type=recovery')) {
      router.push('/auth/forgot-password');
    }
  });

  // Clean up timer when component is unmounted
  onUnmounted(() => {
    cleanupCountdown();
  });

  // Watch for navigation and clean up timer
  watch(
    () => route.path,
    () => {
      cleanupCountdown();
    }
  );
  // Keep track of the countdown interval
  let countdownInterval: number | null = null;

  // Cleanup function for the countdown timer
  const cleanupCountdown = () => {
    if (countdownInterval) {
      window.clearInterval(countdownInterval);
      countdownInterval = null;
    }
  };

  // Handle reset password form submission
  const handleResetPassword = async (): Promise<void> => {
    error.value = '';

    // Validate form before submission
    const { valid } = (await form.value?.validate()) ?? { valid: false };
    if (!valid) {
      error.value = 'Please fix the form errors before submitting.';
      return;
    }

    try {
      const result = await updatePassword(password.value);
      if (result) {
        successMessage.value = 'Your password has been reset successfully!';

        // Reset form state
        form.value?.reset();

        // Cleanup any existing interval
        cleanupCountdown();

        // Start countdown timer
        countdownInterval = window.setInterval(() => {
          redirectCountdown.value--;
          if (redirectCountdown.value <= 0) {
            cleanupCountdown();
            router.push('/auth/login');
          }
        }, 1000);
      } else {
        error.value = authError.value || 'Failed to reset password. Please try again.';
      }
    } catch (err: any) {
      // More specific error messages based on common scenarios
      if (err?.message?.includes('expired')) {
        error.value = 'The password reset link has expired. Please request a new one.';
      } else if (err?.message?.includes('invalid')) {
        error.value = 'The password reset link is invalid. Please request a new one.';
      } else {
        error.value = 'An error occurred while resetting your password. Please try again.';
      }
      console.error('Error resetting password:', err);
    }
  };
</script>
