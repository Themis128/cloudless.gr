<template>
  <v-app class="auth-layout">
    <!-- Animated Background with hydration-safe rendering -->
    <ClientOnly>
      <VantaClouds2Background />
    </ClientOnly>

    <!-- App Bar -->
    <v-app-bar color="transparent" elevation="0" app class="px-4">
      <NuxtLink to="/" class="d-flex align-center text-decoration-none">
        <v-img src="/logo.png" alt="Cloudless Logo" max-width="40" class="me-2" />
        <span class="text-h6 font-weight-bold text-white">Cloudless</span>
      </NuxtLink>

      <v-spacer />

      <v-btn v-if="showBackButton" icon variant="text" color="white" @click="router.back()">
        <v-icon>mdi-arrow-left</v-icon>
        <v-tooltip activator="parent" location="bottom">Go Back</v-tooltip>
      </v-btn>
    </v-app-bar>

    <!-- Auth Card Content -->
    <v-main>
      <v-container fluid class="fill-height d-flex align-center justify-center pa-4">
        <v-row justify="center" align="center" class="fill-height">
          <v-col cols="12" sm="8" md="6" lg="4">
            <!-- Inject your login card here -->
            <slot />
          </v-col>
        </v-row>
      </v-container>

      <!-- Snackbar/Toast -->
      <v-snackbar
        v-model="toast.snackbar.show"
        :color="toast.snackbar.color"
        :timeout="toast.snackbar.timeout"
        :location="toast.snackbar.location"
        class="auth-snackbar"
      >
        {{ toast.snackbar.text }}
        <template #actions>
          <v-btn
            v-if="toast.snackbar.action"
            variant="text"
            :color="toast.snackbar.action.color"
            @click="toast.snackbar.action.onClick"
          >
            {{ toast.snackbar.action.text }}
          </v-btn>
          <v-btn variant="text" @click="toast.hideSnackbar">Close</v-btn>
        </template>
      </v-snackbar>
    </v-main>

    <!-- Footer -->
    <v-footer app color="transparent" class="justify-center">
      <span class="text-caption text-white">
        &copy; {{ new Date().getFullYear() }} Cloudless. All rights reserved.
      </span>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
  import { useRoute, useRouter } from '#imports';
  import VantaClouds2Background from '@/components/VantaClouds2Background.vue';
  import { useToast } from '~/composables/useToast';
  import { useUserSession } from '~/composables/useUserSession';

  const route = useRoute();
  const router = useRouter();
  const toast = useToast();
  const { user } = useUserSession();

  const showBackButton = computed(() => {
    const path = route.path;
    return !['/auth/login', '/auth/register', '/auth/signup'].includes(path);
  });

  // Page metadata
  useHead({
    title: 'Authentication - Cloudless',
    meta: [
      {
        name: 'description',
        content:
          'Secure authentication for Cloudless platform. Login or create an account to access our services.',
      },
    ],
  });
  // No redirect logic needed here - handled by middleware
</script>

<style scoped>
  .auth-layout {
    min-height: 100vh;
    background: transparent;
  }

  :deep(.v-main) {
    background: transparent !important;
  }

  :deep(.v-footer) {
    background: transparent !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .text-white {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  :deep(.v-card.auth-card) {
    background: rgba(0, 0, 0, 0.7) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  :deep(.v-btn) {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }
</style>
