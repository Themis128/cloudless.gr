<template>
  <div class="d-flex align-center justify-center fill-height">
    <v-container class="text-center">
      <v-row justify="center">
        <v-col cols="12" sm="8" md="6" lg="4">
          <v-card elevation="3" rounded="lg" class="pa-8">
            <!-- Error Icon -->
            <v-icon icon="mdi-lock-alert" size="80" color="error" class="mb-4" />

            <!-- Title -->
            <h1 class="text-h4 font-weight-bold mb-4 text-error">Access Denied</h1>
            <!-- Dynamic Message -->
            <div v-if="messageType === 'upgrade'">
              <p class="text-body-1 text-medium-emphasis mb-4">
                {{ message }}
              </p>
              <v-icon icon="mdi-star-circle" color="warning" class="mb-2" />
              <p class="text-caption">
                Upgrade your plan to unlock more features and capabilities.
              </p>
            </div>

            <div v-else-if="messageType === 'verify'">
              <p class="text-body-1 text-medium-emphasis mb-4">
                {{ message }}
              </p>
              <v-icon icon="mdi-email-check" color="info" class="mb-2" />
              <p class="text-caption">
                Check your email for a verification link or request a new one.
              </p>
            </div>

            <div v-else>
              <p class="text-body-1 text-medium-emphasis mb-4">
                {{ message }}
              </p>
              <v-icon
                :icon="icon"
                :color="messageType === 'admin' ? 'warning' : 'error'"
                class="mb-2"
              />
              <p class="text-caption">
                {{
                  messageType === 'admin'
                    ? 'Contact your administrator if you believe this is an error.'
                    : 'Please ensure you have the proper access rights.'
                }}
              </p>
            </div>

            <!-- Actions -->
            <v-divider class="my-6" />

            <div class="d-flex flex-column gap-3">
              <template v-if="messageType === 'upgrade'">
                <v-btn
                  color="primary"
                  variant="elevated"
                  :to="'/upgrade'"
                  block
                  prepend-icon="mdi-star"
                >
                  Upgrade Plan
                </v-btn>
              </template>

              <template v-else-if="messageType === 'verify'">
                <v-btn
                  color="primary"
                  variant="elevated"
                  :to="'/auth/verify'"
                  block
                  prepend-icon="mdi-email"
                >
                  Verify Email
                </v-btn>
              </template>

              <template v-else>
                <v-btn
                  color="primary"
                  variant="elevated"
                  @click="goHome"
                  block
                  prepend-icon="mdi-home"
                >
                  Go to Dashboard
                </v-btn>
              </template>

              <v-btn variant="outlined" @click="goBack" block prepend-icon="mdi-arrow-left">
                Go Back
              </v-btn>

              <!-- Support Button -->
              <v-btn
                v-if="['admin', 'permission'].includes(messageType)"
                color="info"
                variant="text"
                href="/contact"
                block
                prepend-icon="mdi-email"
              >
                Contact Support
              </v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({
    public: true, // Allow access to unauthorized page without auth
    layout: 'default',
  });

  useSeoMeta({
    title: 'Access Denied - Cloudless.gr',
    description: 'You do not have permission to access this page.',
    robots: 'noindex, nofollow',
  });

  const route = useRoute();
  const router = useRouter();

  // Get the reason for denial from query params
  const reason = computed(() => (route.query.reason as string) || 'unknown');

  // Determine message type based on reason
  const messageType = computed(() => {
    if (['pro-required', 'business-required'].includes(reason.value)) {
      return 'upgrade';
    }
    if (reason.value === 'email-verification') {
      return 'verify';
    }
    if (reason.value === 'admin-required') {
      return 'admin';
    }
    if (reason.value === 'permission-required') {
      return 'permission';
    }
    return 'unauthorized';
  });

  // Dynamic message based on reason
  const message = computed(() => {
    switch (reason.value) {
      case 'admin-required':
        return 'This section requires administrator privileges.';
      case 'pro-required':
        return 'This feature requires a Pro subscription plan.';
      case 'business-required':
        return 'This feature requires a Business subscription plan.';
      case 'role-required':
        return 'You do not have the required role to access this section.';
      case 'permission-required':
        return 'You do not have permission to perform this action.';
      case 'email-verification':
        return 'Please verify your email address to access this section.';
      default:
        return 'You do not have permission to access this page.';
    }
  });

  // Icon based on message type
  const icon = computed(() => {
    switch (messageType.value) {
      case 'upgrade':
        return 'mdi-star-circle';
      case 'verify':
        return 'mdi-email-check';
      case 'admin':
        return 'mdi-shield-crown';
      case 'permission':
        return 'mdi-account-lock';
      default:
        return 'mdi-shield-alert';
    }
  });

  const goHome = () => {
    router.push('/dashboard');
  };

  const goBack = () => {
    router.back();
  };
</script>

<style scoped>
  .fill-height {
    min-height: 100vh;
  }
</style>
