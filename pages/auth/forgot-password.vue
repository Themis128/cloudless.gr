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

          <v-form v-if="!successMessage" @submit.prevent="handleForgotPassword">
            <v-card-text>
              <p class="text-body-1 mb-4 text-center">
                Enter your email address and we'll send you a link to reset your password.
              </p>

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
                class="mb-4"
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
                {{ isLoading ? 'Sending...' : 'Send Reset Link' }}
              </v-btn>
            </v-card-actions>
          </v-form>

          <v-divider class="mb-4"></v-divider>

          <div class="text-center pb-4">
            <span class="text-body-2">Remembered your password?</span>
            <v-btn variant="text" color="primary" to="/auth/login" class="ml-1"> Log in </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { ref } from '#imports';
  import { useSupabaseAuth } from '~/composables/useSupabaseAuth';

  // Form state
  const email = ref<string>('');
  const error = ref<string>('');
  const successMessage = ref<string>('');
  const isLoading = ref<boolean>(false);

  // Form validation rules
  const emailRules = [
    (v: string) => !!v || 'Email is required',
    (v: string) => /.+@.+\..+/.test(v) || 'Email must be valid',
  ];

  // Import Supabase auth composable
  const { resetPasswordRequest, loading, error: authError } = useSupabaseAuth();
  // Handle forgot password form submission
  const handleForgotPassword = async (): Promise<void> => {
    try {
      isLoading.value = true;
      error.value = '';
      successMessage.value = '';

      if (!email.value) {
        error.value = 'Please enter your email address';
        return;
      }

      const result = await resetPasswordRequest(email.value);
      if (result) {
        successMessage.value = 'Password reset instructions have been sent to your email.';
        email.value = '';
      } else {
        error.value = authError.value || 'Failed to send reset link. Please try again.';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to send password reset email. Please try again.';
      console.error('Error sending reset email:', err);
    } finally {
      isLoading.value = false;
    }
  };
</script>

<style scoped>
  .fill-height {
    min-height: 100vh;
  }

  .v-card {
    background-color: rgba(255, 255, 255, 0.85) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
</style>
