<template>
  <v-container fluid class="fill-height bg-surface">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-4 elevation-8">
          <v-card-title class="text-center text-h4 font-weight-bold pt-8 pb-4">
            Email Verification Required
          </v-card-title>

          <v-alert v-if="error" type="error" variant="tonal" closable class="mb-4">
            {{ error }}
          </v-alert>

          <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-4">
            {{ successMessage }}
          </v-alert>

          <v-card-text>
            <p class="text-body-1 mb-4 text-center">
              Please verify your email address to access this section. Check your inbox for a
              verification link.
            </p>

            <v-alert v-if="!isVerified" type="info" variant="tonal" class="mb-4">
              A verification email has been sent to {{ userEmail }}. Click the link in the email to
              verify your account.
            </v-alert>

            <div v-if="!isVerified" class="text-center">
              <v-btn
                color="primary"
                :loading="loading"
                :disabled="loading"
                @click="handleResendVerification"
                class="mb-4"
              >
                Resend Verification Email
              </v-btn>
            </div>
          </v-card-text>

          <v-divider class="mb-4"></v-divider>

          <div class="text-center pb-4">
            <v-btn variant="text" color="primary" @click="handleSignOut"> Sign Out </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from '#imports';
  import { useRouter } from 'vue-router';
  import { useSupabaseAuth } from '~/composables/useSupabaseAuth';

  const { user, isVerified, resendEmailVerification, signOut } = useSupabaseAuth();
  const router = useRouter();
  const error = ref('');
  const successMessage = ref('');
  const loading = ref(false);

  // Redirect if already verified
  watch(
    () => isVerified.value,
    (newValue) => {
      if (newValue === true) {
        const redirectTo = '/dashboard';
        router.push(redirectTo);
      }
    },
    { immediate: true }
  );

  const userEmail = computed(() => user.value?.email || '');

  const handleResendVerification = async () => {
    loading.value = true;
    error.value = '';
    successMessage.value = '';

    try {
      const result = await resendEmailVerification(userEmail.value);
      if (result) {
        successMessage.value = 'Verification email has been resent. Please check your inbox.';
      } else {
        error.value = 'Failed to resend verification email. Please try again.';
      }
    } catch (err: any) {
      error.value = err.message || 'An error occurred. Please try again.';
    } finally {
      loading.value = false;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };
</script>

<style scoped>
  .fill-height {
    min-height: 100vh;
  }
</style>
