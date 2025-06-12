<template>
  <v-container class="py-16">
    <v-card width="400" class="mx-auto">
      <v-card-title>Register</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="handleRegister">
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
          <v-btn type="submit" block color="primary">Register</v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
const email = ref('')
const password = ref('')
const router = useRouter()
const { $supabase } = useNuxtApp()

async function handleRegister() {
  const { error } = await $supabase.auth.signUp({
    email: email.value,
    password: password.value,
  })

  if (error) return alert(error.message)
  alert('Check your email to confirm!')
  router.push('/auth/login')
}
</script>
