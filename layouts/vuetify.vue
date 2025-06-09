<template>
  <v-app>
    <!-- Vanta.js Clouds2 Background -->
    <VantaClouds2Background />

    <!-- Vuetify Navigation -->
    <Layout-Navigation-VuetifyNav />

    <!-- Main Content -->
    <v-main class="content-container">
      <!-- Slot for page content -->
      <slot />
    </v-main>

    <!-- Footer -->
    <v-footer app>
      <v-container>
        <v-row justify="center" align="center">
          <v-col cols="12" class="text-center">
            <span
              >&copy; {{ new Date().getFullYear() }} Cloudless.gr - Powered by Vuetify & Nuxt</span
            >
          </v-col>
        </v-row>
      </v-container>
    </v-footer>
  </v-app>
</template>

<script setup>
  // Vuetify layout
</script>

<style scoped>
  .content-container {
    position: relative;
    z-index: 1;
  }

  :deep(.v-main) {
    background: transparent !important;
  }

  :deep(.v-footer) {
    background: transparent !important;
    backdrop-filter: blur(5px);
    border: none !important;
  }
</style>
