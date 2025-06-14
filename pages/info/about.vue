<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-6" elevation="4">
          <v-card-title class="text-h5 font-weight-bold">About Cloudless GR</v-card-title>
          <v-card-text>
            <p class="mb-4">
              Cloudless GR is a modular LLM dev agent platform built with Nuxt 3, Supabase, and Vuetify 3. Our mission is to empower developers with modern, accessible, and scalable tools for building AI-driven applications.
            </p>
            <p>
              This project is open to community contributions and aims to provide a robust foundation for rapid prototyping and deployment of LLM-powered solutions.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  title: 'About - Cloudless GR',
  description: 'Learn more about the Cloudless GR platform, its mission, and its technology stack.'
})
</script>

<style scoped>
p {
  font-size: 1.1rem;
}
</style>
