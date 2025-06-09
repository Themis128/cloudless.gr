<template>
  <v-row justify="center" align="center" class="fill-height">
    <v-col cols="12" sm="8" md="6" lg="4">
      <v-card class="pa-8 elevation-12 auth-card" rounded="xl">
        <!-- Logo and Title -->
        <div class="text-center mb-6">
          <v-img src="/logo.png" alt="Cloudless Logo" width="72" height="72" class="mx-auto mb-6" />
          <h1 class="text-h4 font-weight-bold text-primary mb-2">Verify Your Email</h1>
          <p class="text-body-1 text-medium-emphasis">
            Please verify your email address to continue
          </p>
        </div>

        <!-- Error Alert -->
        <v-slide-y-transition>
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            closable
            class="mb-6"
            border="start"
            elevation="2"
          >
            {{ error }}
          </v-alert>
        </v-slide-y-transition>

        <!-- Success Alert -->
        <v-slide-y-transition>
          <v-alert
            v-if="successMessage"
            type="success"
            variant="tonal"
            class="mb-6"
            border="start"
            elevation="2"
          >
            {{ successMessage }}
          </v-alert>
        </v-slide-y-transition>

        <!-- Info Alert -->
        <v-slide-y-transition>
          <v-alert
            v-if="!isVerified"
            type="info"
            variant="tonal"
            class="mb-6"
            border="start"
            elevation="2"
          >
            <strong>Verification email sent to:</strong><br />
            {{ userEmail }}
          </v-alert>
        </v-slide-y-transition>

        <div class="text-center mb-8">
          <p class="text-body-1 text-medium-emphasis mb-6">
            Can't find the email? Check your spam folder or request a new verification link.
          </p>

          <v-btn
            v-if="!isVerified"
            color="primary"
            size="x-large"
            :loading="loading"
            :disabled="loading"
            @click="handleResendVerification"
            class="mb-4 py-6"
            block
            elevation="2"
          >
            <v-icon start icon="mdi-email-check" class="mr-2" />
            {{ loading ? 'Sending...' : 'Resend Verification Email' }}
          </v-btn>

          <v-btn
            variant="outlined"
            color="primary"
            @click="handleSignOut"
            class="mt-4"
            block
            elevation="0"
          >
            <v-icon start icon="mdi-logout" class="mr-2" />
            Sign Out
          </v-btn>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from '#imports';
  import { useRouter } from 'vue-router';
  import { useSupabaseAuth } from '~/composables/useSupabaseAuth';

  const {
    user,
    isVerified,
    sendVerificationEmail: resendEmailVerification,
    signOut,
  } = useSupabaseAuth();

  const router = useRouter();
  const error = ref<string>('');
  const successMessage = ref<string>('');
  const loading = ref<boolean>(false);

  // Redirect if already verified
  watch(
    () => isVerified.value,
    (newValue: boolean) => {
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
      await resendEmailVerification(userEmail.value);
      successMessage.value = 'Verification email has been resent. Please check your inbox.';
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

  // Set page meta
  definePageMeta({
    layout: 'auth',
    public: true,
  });
</script>

<style lang="scss" scoped>
  .auth-card {
    --field-bg-opacity: 0.1;
    --field-border-opacity: 0.6;
    --hover-opacity: 0.8;

    backdrop-filter: none;
    background: transparent !important;
    border: none;
    box-shadow: none;

    // Style text elements
    h1,
    p,
    .text-medium-emphasis {
      color: rgb(var(--v-theme-primary-rgb)) !important;
    }

    // Style buttons
    :deep(.v-btn) {
      border-radius: 12px;
      transition: all 0.3s ease;
      background: transparent !important;
      border: 1px solid rgba(var(--v-theme-primary-rgb), 0.5);

      &:not(.v-btn--disabled) {
        &:hover {
          transform: translateY(-1px);
          border-color: rgb(var(--v-theme-primary-rgb));
          background: rgba(var(--v-theme-surface-rgb), 0.1) !important;
          box-shadow: 0 4px 12px rgba(var(--v-theme-primary-rgb), 0.2);
        }
      }
    }

    // Style alerts
    .v-alert {
      border-radius: 12px;
      background: rgba(var(--v-theme-surface-rgb), 0.1) !important;
      border: 1px solid currentColor;

      :deep(.v-alert-title),
      :deep(.v-alert__content) {
        color: currentColor !important;
      }
    }
  }

  .fill-height {
    min-height: 100vh;
  }

  // Custom transitions
  .v-enter-active,
  .v-leave-active {
    transition: opacity 0.3s ease;
  }

  .v-enter-from,
  .v-leave-to {
    opacity: 0;
  }
</style>
