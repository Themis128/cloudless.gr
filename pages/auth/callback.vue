<template>
  <div class="d-flex align-center justify-center fill-height">
    <v-card class="pa-8 text-center" elevation="3" rounded="lg" max-width="400">
      <!-- Loading State -->
      <div v-if="!error && !success">
        <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
        <h2 class="text-h5 mb-2">Completing Authentication...</h2>
        <p class="text-body-1 text-medium-emphasis">Please wait while we finish signing you in.</p>
      </div>

      <!-- Success State -->
      <div v-else-if="success">
        <v-icon icon="mdi-check-circle" size="64" color="success" class="mb-4" />
        <h2 class="text-h5 mb-2 text-success">Authentication Successful!</h2>
        <p class="text-body-1 text-medium-emphasis">Redirecting you to your dashboard...</p>
      </div>

      <!-- Error State -->
      <div v-else>
        <v-icon icon="mdi-alert-circle" size="64" color="error" class="mb-4" />
        <h2 class="text-h5 mb-2 text-error">Authentication Failed</h2>
        <p class="text-body-1 text-medium-emphasis mb-4">
          {{ errorMessage }}
        </p>
        <v-btn color="primary" variant="elevated" @click="redirectToLogin" block>
          Return to Login
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({
    layout: 'auth',
    public: true,
  });

  const route = useRoute();
  const supabase = useSupabaseClient();
  const { getRedirectTo } = usePostLoginRedirect();

  // State
  const loading = ref(true);
  const success = ref(false);
  const error = ref(false);
  const errorMessage = ref('');

  // Handle OAuth callback
  onMounted(async () => {
    try {
      // Get code from URL
      const code = route.query.code as string;

      if (!code) {
        throw new Error('No code received from authentication provider');
      }

      // Exchange code for session
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        throw exchangeError;
      }

      // Validate session
      if (!data.session || !data.user) {
        throw new Error('No session or user data received');
      }

      success.value = true;

      // Small delay to show success state before redirect
      setTimeout(async () => {
        // Redirect to intended destination or default
        const redirectTo = await getRedirectTo();
        await navigateTo(redirectTo || '/');
      }, 1500);
    } catch (err: any) {
      error.value = true;
      errorMessage.value = err.message || 'An error occurred during authentication';
      console.error('Auth callback error:', err);
    } finally {
      loading.value = false;
    }
  });

  // Helper function to redirect back to login
  const redirectToLogin = () => {
    navigateTo('/auth/login');
  };
</script>

<style scoped>
  .fill-height {
    min-height: calc(100vh - 64px); /* Adjust based on your layout */
  }
</style>
