<template>
  <v-app>
    <!-- Vanta.js Clouds2 Background -->
    <VantaClouds2Background />

    <v-main class="content-container">
      <NuxtPage />
    </v-main>
  </v-app>
</template>

<script setup>
// Components are auto-imported in Nuxt 3
</script>

<style>
.content-container {
  background: transparent !important;
  position: relative;
  z-index: 1;
}

:deep(.v-application) {
  background: transparent !important;
}

/* Make sure cards and other elements are properly visible */
:deep(.v-card) {
  background-color: rgba(0, 0, 0, 0.7) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Ensure text is readable */
:deep(.v-card),
:deep(.v-text-field) {
  color: white !important;
}

:deep(.v-text-field .v-field) {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.v-text-field .v-field__input) {
  color: white !important;
}

:deep(.v-text-field .v-label) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.v-btn) {
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

:deep(.v-btn:hover) {
  background: rgba(255, 255, 255, 0.2) !important;
}
</style>
