<template>
  <v-container fluid class="pa-0">
    <v-row class="ma-0" justify="center" align="center" style="min-height: 100vh">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-4 elevation-8">
          <v-card-title class="text-center text-h4 font-weight-bold pt-8 pb-4">
            Admin Login
          </v-card-title>

          <v-alert v-if="error" type="error" variant="tonal" closable class="mb-4">
            {{ error }}
          </v-alert>

          <v-form @submit.prevent="login">
            <v-card-text>
              <v-text-field
                v-model="username"
                label="Username"
                required
                prepend-inner-icon="mdi-account"
                variant="outlined"
                placeholder="Enter your username"
                autocomplete="username"
                class="mb-3"
              />
              <v-text-field
                v-model="password"
                label="Password"
                required
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                placeholder="Enter your password"
                autocomplete="current-password"
                class="mb-4"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showPassword = !showPassword"
                :type="showPassword ? 'text' : 'password'"
              />
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
                {{ isLoading ? 'Logging in...' : 'Login' }}
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { useRouter } from 'nuxt/app';
  import { ref } from 'vue';

  // State management
  const username = ref<string>('');
  const password = ref<string>('');
  const error = ref<string>('');
  const isLoading = ref<boolean>(false);
  const showPassword = ref<boolean>(false);

  // For demo purposes, hardcoded credentials
  // In a real application, you would use a secure authentication system
  const DEMO_USERNAME: string = 'admin';
  const DEMO_PASSWORD: string = 'cloudless2025';

  const router = useRouter();

  // Login function
  const login = async (): Promise<void> => {
    isLoading.value = true;
    error.value = '';

    // Simple validation
    if (!username.value || !password.value) {
      error.value = 'Username and password are required';
      isLoading.value = false;
      return;
    }

    // Simulate API call
    setTimeout(() => {
      // Check credentials
      if (username.value === DEMO_USERNAME && password.value === DEMO_PASSWORD) {
        // Store authentication state in localStorage
        if (process.client) {
          localStorage.setItem('admin_authenticated', 'true');
        }

        // Redirect to admin dashboard
        router.push('/admin/contact-submissions');
      } else {
        error.value = 'Invalid username or password';
      }

      isLoading.value = false;
    }, 1000);
  };
</script>

<style scoped>
  .v-card {
    background-color: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
  }

  .pa-0 {
    position: relative;
    z-index: 2;
  }
</style>
