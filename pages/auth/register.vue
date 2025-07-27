<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card>
          <v-card-title class="text-h4 text-center pa-6">
            Register
          </v-card-title>
          
          <v-card-text>
            <v-form @submit.prevent="handleRegister">
              <v-text-field
                v-model="form.name"
                label="Name"
                required
                :rules="[rules.required]"
                prepend-icon="mdi-account"
                class="mb-4"
              />
              
              <v-text-field
                v-model="form.email"
                label="Email"
                type="email"
                required
                :rules="[rules.required, rules.email]"
                prepend-icon="mdi-email"
                class="mb-4"
              />
              
              <v-text-field
                v-model="form.password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                required
                :rules="[rules.required, rules.minLength]"
                prepend-icon="mdi-lock"
                :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append="showPassword = !showPassword"
                class="mb-4"
              />
              
              <v-text-field
                v-model="form.confirmPassword"
                label="Confirm Password"
                :type="showPassword ? 'text' : 'password'"
                required
                :rules="[rules.required, rules.passwordMatch]"
                prepend-icon="mdi-lock-check"
                class="mb-4"
              />
              
              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                :loading="loading"
                :disabled="!isFormValid"
              >
                Register
              </v-btn>
            </v-form>
            
            <v-alert
              v-if="error"
              type="error"
              class="mt-4"
              dismissible
              @click:close="error = null"
            >
              {{ error }}
            </v-alert>
          </v-card-text>
          
          <v-card-actions class="justify-center pb-4">
            <span>Already have an account?</span>
            <v-btn
              text
              color="primary"
              to="/auth/login"
              class="ml-2"
            >
              Login
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '~/stores/authStore'

const authStore = useAuthStore()
const router = useRouter()

const form = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const rules = {
  required: (v: string) => !!v || 'This field is required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email',
  minLength: (v: string) => v.length >= 8 || 'Password must be at least 8 characters',
  passwordMatch: (v: string) => v === form.value.password || 'Passwords do not match'
}

const isFormValid = computed(() => {
  return form.value.name && 
         form.value.email && 
         form.value.password && 
         form.value.confirmPassword &&
         /.+@.+\..+/.test(form.value.email) &&
         form.value.password.length >= 8 &&
         form.value.password === form.value.confirmPassword
})

const handleRegister = async () => {
  if (!isFormValid.value) return
  
  loading.value = true
  error.value = null
  
  try {
    const result = await authStore.register({
      name: form.value.name,
      email: form.value.email,
      password: form.value.password,
      confirmPassword: form.value.confirmPassword
    })
    
    if (result.success) {
      // Redirect to dashboard
      await router.push('/dashboard')
    } else {
      error.value = result.error || 'Registration failed'
    }
  } catch (err: any) {
    error.value = err.message || 'An error occurred during registration'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.v-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-card {
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
</style> 