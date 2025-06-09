<template>
  <v-app>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </v-app>
</template>

<script setup lang="ts">
// Set up Vuetify app container for proper styling
</script>

<style>
/* Apply global resets and fallback background */
html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  overflow-x: hidden;
  background-color: #7ec0ee; /* fallback sky-blue if Vanta fails */
}
</style>
