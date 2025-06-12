<template>
  <v-container class="py-16">
    <v-card width="400" class="mx-auto">
      <v-card-title>Reset Password</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="handleReset">
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            required
          />
          <v-btn type="submit" block color="primary">Send Reset Link</v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
const email = ref('')
const { $supabase } = useNuxtApp()

async function handleReset() {
  const { error } = await $supabase.auth.resetPasswordForEmail(email.value)
  if (error) return alert(error.message)
  alert('Reset link sent. Check your inbox.')
}
</script>
