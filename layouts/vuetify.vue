<template>
  <div class="position-relative">
    <!-- Vanta.js Clouds2 Background -->
    <VantaClouds2Background v-if="showVanta" />

    <!-- Vuetify Navigation -->
    <Layout-Navigation-VuetifyNav />

    <!-- Main Content -->
    <v-main class="content-container">
      <!-- Slot for page content -->
      <slot />
    </v-main>

    <!-- Footer -->
    <v-footer app class="footer-transparent">
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
  </div>
</template>

<script setup lang="ts">
// Vuetify layout
import { ref } from 'vue';
import VantaClouds2Background from '@/components/VantaClouds2Background.vue';

// Enable vanta background
const showVanta = ref(true);
</script>

<style scoped>
  .content-container {
    position: relative;
    z-index: 1;
  }

  .footer-transparent {
    background-color: rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
</style>
