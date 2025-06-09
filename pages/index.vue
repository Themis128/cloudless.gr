<template>
  <v-container fluid class="fill-height">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" sm="8" md="6" lg="5" xl="4">
        <v-card
          elevation="8"
          rounded="xl"
          class="mx-auto pa-8 text-center"
          color="rgba(255, 255, 255, 0.95)"
        >
          <v-card-text>
            <v-icon icon="mdi-cloud" size="64" color="primary" class="mb-4" />

            <h1 class="text-h3 text-primary font-weight-bold mb-4">Welcome to Cloudless</h1>

            <p class="text-body-1 text-medium-emphasis mb-6">
              Please log in to access the application and start building amazing projects.
            </p>
            <div class="d-flex flex-column flex-sm-row ga-4 justify-center">
              <v-btn
                to="/auth/login"
                variant="outlined"
                color="primary"
                size="large"
                rounded="lg"
                min-width="140"
                prepend-icon="mdi-login"
              >
                Login
              </v-btn>

              <v-btn
                to="/auth/signup"
                variant="elevated"
                color="primary"
                size="large"
                rounded="lg"
                min-width="140"
                prepend-icon="mdi-account-plus"
              >
                Sign Up
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { useUserAuth } from '~/composables/useUserAuth';

  const { isLoggedIn } = useUserAuth();

  // If user is already logged in, redirect to dashboard
  if (process.client && isLoggedIn.value) {
    await navigateTo('/dashboard');
  }

  // Set page title and meta
  useHead({
    title: 'Welcome to Cloudless - Modern Development Platform',
    meta: [
      {
        name: 'description',
        content:
          'Welcome to Cloudless - A modern development platform for building amazing applications.',
      },
    ],
  });
</script>
