<template>
  <div class="register-outer">
    <v-card class="glass-card pa-6" elevation="12">
      <v-card-title class="text-h5 text-white text-center pb-2">Register</v-card-title>
      <v-form @submit.prevent="handleRegister" validate-on="submit lazy">
        <v-text-field v-model="firstName" label="First Name" prepend-icon="mdi-account" clearable color="blue"
          class="glass-input mb-4" :rules="[rules.required]" :tabindex="1" />
        <v-text-field v-model="lastName" label="Last Name" prepend-icon="mdi-account" clearable color="blue"
          class="glass-input mb-4" :rules="[rules.required]" :tabindex="2" />
        <v-text-field v-model="email" label="Email" placeholder="you@example.com" prepend-icon="mdi-email-outline"
          clearable color="blue" class="glass-input mb-4" :rules="[rules.required, rules.email]" :tabindex="3" />
        <v-text-field v-model="password" :type="showPassword ? 'text' : 'password'" label="Password"
          prepend-icon="mdi-lock-outline" :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append="showPassword = !showPassword" clearable color="blue" class="glass-input mb-4"
          :rules="[rules.required, rules.minLength]" :tabindex="4" />
        <v-btn type="submit" block color="blue" class="mt-4">Register</v-btn>
      </v-form>
      <NuxtLink to="/auth/login" class="login-link mt-4">
        <v-icon left size="18" color="#3b82f6">mdi-login</v-icon>
        <span>Already have an account? <span class="gradient-text">Login</span></span>
      </NuxtLink>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo } from '#app'
import { useSupabase, setupUserStorage } from '@/composables/useSupabase'

const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const showPassword = ref(false)
const supabase = useSupabase()

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email',
  minLength: (v: string) => v.length >= 6 || 'Min 6 characters'
}

async function handleRegister() {
  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value
  })
  if (error) {
    alert(error.message)
  } else {
    try {
      const userId = data.user?.id
      if (userId) {
        // Insert user profile with first and last name into 'profiles' table
        await supabase
          .from('profiles')
          .insert({ id: userId, first_name: firstName.value, last_name: lastName.value })

        // Ensure session is available before setting up storage
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          await setupUserStorage(supabase, userId)
        }
      }
    } catch (e) {
      alert('Storage setup failed: ' + (e as Error).message)
    }
    navigateTo('/dashboard')
  }
}
</script>

<style scoped>
.register-outer {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  padding: 2rem 0;
}

.glass-card {
  width: 100%;
  max-width: 410px;
  background: rgba(255, 255, 255, 0.13);
  border-radius: 22px;
  box-shadow: 0 12px 40px 0 rgba(40, 40, 80, 0.18), 0 1.5px 8px 0 rgba(80, 80, 160, 0.10);
  backdrop-filter: blur(18px);
  border: 1.5px solid rgba(168, 85, 247, 0.13);
}

.glass-input input {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
  letter-spacing: 0.02em;
  padding: 12px 16px !important;
  font-size: 1.08rem;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  background: rgba(255, 255, 255, 0.10) !important;
  backdrop-filter: blur(2px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.10);
}

.v-label {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
}

::placeholder {
  color: #f3f6fa !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.35);
  opacity: 1;
}

.login-link {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  font-weight: 500;
  color: #3b82f6;
  gap: 0.4em;
  text-decoration: none;
  transition: color 0.2s;
}

.login-link:hover {
  color: #a855f7;
}

.gradient-text {
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}
</style>
