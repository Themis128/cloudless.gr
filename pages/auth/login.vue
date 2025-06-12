<template>
  <v-container class="py-16">
    <v-card width="400" class="mx-auto">
      <v-card-title>Login</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="handleLogin">
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            required
          />
          <v-text-field
            v-model="password"
            label="Password"
            type="password"
            required
          />
          <v-btn type="submit" block color="primary">Login</v-btn>
          <v-btn variant="text" block @click="$router.push('/auth/reset')">
            Forgot password?
          </v-btn>
        </v-form>
        <NuxtLink to="/auth/register" class="text-sm text-blue-600 block mt-4">
          Don’t have an account? Register
        </NuxtLink>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
const email = ref('')
const password = ref('')
const router = useRouter()
const { $supabase } = useNuxtApp()

async function handleLogin() {
  const { error } = await $supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (error) return alert(error.message)
  router.push('/dashboard') // or home
}
</script>
