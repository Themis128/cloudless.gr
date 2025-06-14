<template>
  <v-container fluid fill-height class="d-flex justify-center align-center" role="main" aria-label="Password Reset Page">
    <ResetForm />
  </v-container>
</template>

<script setup lang="ts">
import ResetForm from '@/components/auth/ResetForm.vue'
definePageMeta({ layout: 'auth' })
</script>

<style scoped>
:deep(html),
:deep(body),
:deep(#__nuxt) {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
.v-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
