<template>
  <v-container fluid class="fill-height bg-surface">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-4 elevation-8">
          <v-card-title class="text-center text-h4 font-weight-bold pt-8 pb-4">
            Create your Account
          </v-card-title>
          <v-alert v-if="error" type="error" variant="tonal" closable class="mb-4">
            {{ error }}
          </v-alert>

          <v-form @submit.prevent="handleSignup" v-model="formValid">
            <v-card-text>
              <v-text-field
                v-model="fullName"
                label="Full Name"
                type="text"
                required
                :rules="nameRules"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                placeholder="Enter your full name"
                autocomplete="name"
                class="mb-2"
              ></v-text-field>

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
              ></v-text-field>

              <v-text-field
                v-model="password"
                label="Password"
                required
                :rules="passwordRules"
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                placeholder="Enter your password (min 6 characters)"
                autocomplete="new-password"
                class="mb-4"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showPassword = !showPassword"
                :type="showPassword ? 'text' : 'password'"
              ></v-text-field>

              <v-checkbox v-model="agreeToTerms" color="primary" hide-details class="mb-4">
                <template #label>
                  <span class="text-body-2">
                    I agree to the
                    <v-btn
                      variant="text"
                      color="primary"
                      size="small"
                      to="/terms"
                      class="pa-0 text-decoration-underline"
                    >
                      Terms of Service
                    </v-btn>
                  </span>
                </template>
              </v-checkbox>
            </v-card-text>

            <v-card-actions class="px-4 pb-4">
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                :disabled="loading || !agreeToTerms || !formValid"
              >
                {{ loading ? 'Creating account...' : 'Create Account' }}
              </v-btn>
            </v-card-actions>
          </v-form>

          <v-divider class="mb-4"></v-divider>

          <div class="text-center pb-4">
            <span class="text-body-2">Already have an account?</span>
            <v-btn variant="text" color="primary" to="/auth/login" class="ml-1"> Log in </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  const { signUp, loading, error } = useSupabaseAuth();

  const formValid = ref(false);
  const email = ref('');
  const password = ref('');
  const fullName = ref('');
  const showPassword = ref(false);
  const agreeToTerms = ref(false);

  const nameRules = [
    (v: string) => !!v || 'Full name is required',
    (v: string) => v.length >= 2 || 'Name must be at least 2 characters',
  ];

  const emailRules = [
    (v: string) => !!v || 'Email is required',
    (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid',
  ];

  const passwordRules = [
    (v: string) => !!v || 'Password is required',
    (v: string) => v.length >= 8 || 'Password must be at least 8 characters',
    (v: string) => /[A-Z]/.test(v) || 'Password must contain at least one uppercase letter',
    (v: string) => /[0-9]/.test(v) || 'Password must contain at least one number',
  ];

  const handleSignup = async () => {
    if (!formValid.value || !agreeToTerms.value) return;

    await signUp(email.value, password.value, {
      full_name: fullName.value,
    });

    if (!error.value) {
      // Show success message and redirect to login
      await navigateTo('/auth/login?message=verification-email-sent');
    }
  };
  // Set page meta
  definePageMeta({
    layout: 'default',
    public: true,
  });

  // Set page title
  useHead({
    title: 'Sign Up - Cloudless',
  });
</script>

<style scoped>
  .auth-container {
    min-height: 90vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
  }

  .auth-card {
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 0.75rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    padding: 2rem;
    width: 100%;
    max-width: 400px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  h1 {
    color: #1e40af;
    font-size: 1.8rem;
    text-align: center;
    margin-bottom: 1.5rem;
    font-weight: 700;
  }

  .error-message {
    background-color: rgba(239, 68, 68, 0.1);
    color: rgb(185, 28, 28);
    padding: 0.75rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    text-align: center;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #334155;
  }

  input {
    padding: 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid #cbd5e1;
    background-color: white;
    font-size: 1rem;
    width: 100%;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .auth-button {
    background-color: #1e40af;
    color: white;
    font-weight: 600;
    padding: 0.75rem;
    border-radius: 0.375rem;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-top: 0.75rem;
  }

  .auth-button:hover {
    background-color: #1e3a8a;
  }

  .auth-button:disabled {
    background-color: #94a3b8;
    cursor: not-allowed;
  }

  .auth-links {
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.875rem;
    color: #64748b;
  }

  .auth-links a {
    color: #2563eb;
    font-weight: 500;
    text-decoration: none;
  }

  .auth-links a:hover {
    text-decoration: underline;
  }
</style>
