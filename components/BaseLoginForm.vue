<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh;">
    <v-card class="pa-6" elevation="8" max-width="420">
      <slot name="logo" />
      <v-card-title class="text-h5 font-weight-bold mb-4">{{ title }}</v-card-title>
      <v-form ref="formRef" v-model="valid" @submit.prevent="handleLogin">
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          :rules="[
            (v: string) => !!v || 'Email is required',
            (v: string) => /.+@.+\..+/.test(v) || 'E-mail must be valid'
          ]"
          required
          class="mb-3"
        />
        <v-text-field
          v-model="password"
          label="Password"
          type="password"
          autocomplete="current-password"
          :rules="[(v: string) => !!v || 'Password is required']"
          required
          class="mb-4"
        />
        <slot name="actions-above" />
        <v-btn
          type="submit"
          color="primary"
          block
          :loading="loading"
          :disabled="!valid || loading"
        >
          {{ buttonText }}
        </v-btn>
        <slot name="actions-below" />
        <v-alert
          v-if="error"
          type="error"
          class="mt-3"
          aria-live="assertive"
        >{{ error }}</v-alert>
      </v-form>
      <slot name="footer" />
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  title: { type: String, default: 'Login' },
  buttonText: { type: String, default: 'Sign In' },
  redirect: { type: String, default: '/dashboard' },
  onLogin: { type: Function, required: true }, // (email, password) => Promise<{ error?: string }>
  sessionCheck: { type: Function, default: null }, // optional async function to check session
})

const email = ref('')
const password = ref('')
const error = ref('')
const valid = ref(true)
const loading = ref(false)
const formRef = ref()
const router = useRouter()

onMounted(async () => {
  if (props.sessionCheck) {
    const shouldRedirect = await props.sessionCheck()
    if (shouldRedirect) {
      router.push(props.redirect)
    }
  }
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  const isValid = await formRef.value?.validate?.()
  if (!isValid) {
    loading.value = false
    return
  }
  const result = await props.onLogin(email.value, password.value)
  loading.value = false
  if (result?.error) {
    password.value = ''
    error.value = result.error
    return
  }
  router.push(props.redirect)
}
</script>
