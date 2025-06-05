<template>
  <div class="d-flex align-center justify-center fill-height">
    <v-card class="pa-8 text-center">
      <v-progress-circular
        indeterminate
        size="64"
        color="primary"
        class="mb-4"
      />
      <h2 class="text-h5 mb-2">Completing Authentication...</h2>
      <p class="text-body-1 text-medium-emphasis">
        Please wait while we finish signing you in.
      </p>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

import { handleAuthRedirect } from '~/utils/auth-helpers'
import { useRouter } from '#imports'

const router = useRouter()

onMounted(async () => {
  const success = await handleAuthRedirect()
  if (!success) {
    // If auth fails, redirect back to login
    router.push('/auth/login')
  }
})
</script>
