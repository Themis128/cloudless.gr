<template>
  <v-container fluid fill-height class="d-flex justify-center align-center">
    <RegisterForm />
  </v-container>
</template>

<script setup>
import RegisterForm from '@/components/auth/RegisterForm.vue'
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
</style>
