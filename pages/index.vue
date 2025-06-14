<template>
  <v-container class="py-12 text-center">
    <h1 class="text-h3 font-weight-bold mb-6">Welcome to Cloudless GR</h1>
    <p class="mb-8">
      Your modular LLM dev agent platform, built with Nuxt 3, Supabase, and Vuetify 3.
    </p>
    <v-btn to="/info" color="primary" class="ma-2" variant="outlined" aria-label="Go to Info Center">Info Center</v-btn>
    <v-btn to="/projects" color="primary" class="ma-2" variant="outlined" aria-label="Go to Projects">Projects</v-btn>
    <v-btn to="/dashboard" color="primary" class="ma-2" variant="outlined" aria-label="Go to Dashboard">Dashboard</v-btn>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  title: 'Cloudless GR',
  description: 'A modular LLM dev agent platform built with Nuxt 3 and Supabase.'
})
</script>

<style scoped>
h1 {
  letter-spacing: 1px;
}
p {
  font-size: 1.2rem;
}
</style>
