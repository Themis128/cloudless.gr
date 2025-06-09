<template>
  <v-app>
    <!-- Vanta.js Clouds2 Background with admin theme -->
    <VantaClouds2Background />

    <v-app-bar color="primary" dark app elevation="2" class="transparent-overlay">
      <v-toolbar-title>Admin Dashboard</v-toolbar-title>
      <v-spacer />
      <v-btn to="/admin/dashboard" variant="text" class="text-white">Dashboard</v-btn>
      <v-btn to="/admin/users" variant="text" class="text-white">Users</v-btn>
      <v-btn to="/admin/projects" variant="text" class="text-white">Projects</v-btn>
      <v-btn to="/admin/contact-submissions" variant="text" class="text-white"
        >Contact Submissions</v-btn
      >
      <v-btn @click="logout" variant="text" class="text-white">Logout</v-btn>
    </v-app-bar>
    <v-main>
      <v-container class="py-8 admin-content-container">
        <slot />
      </v-container>
    </v-main>
    <v-footer app class="footer-transparent">
      <p>Admin area - For authorized users only</p>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
  import VantaClouds2Background from '@/components/Base/VantaClouds2Background.vue';
  import { useRouter } from 'nuxt/app';

  const router = useRouter();
  const logout = async () => {
    localStorage.removeItem('admin_authenticated');
    await router.push('/admin/login');
  };
</script>

<style scoped>
  .transparent-overlay {
    background-color: rgba(0, 0, 0, 0.4) !important; /* Slightly darker for admin */
    backdrop-filter: blur(3px);
  }

  .footer-transparent {
    background: transparent !important;
    color: white !important;
    border: none !important;
    backdrop-filter: none !important;
  }

  .admin-content-container {
    position: relative;
    z-index: 1;
    background-color: rgba(255, 255, 255, 0.6);
    border-radius: 8px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    padding: 25px;
    border-left: 4px solid rgba(24, 103, 192, 0.8); /* Admin accent color with transparency */
  }

  /* Ensure content is above the Vanta background */
  .v-main {
    position: relative;
    z-index: 1;
  }

  /* Card and button styling for admin area */
  :deep(.v-card) {
    background-color: rgba(255, 255, 255, 0.7) !important;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  :deep(.v-btn) {
    font-weight: 500;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }

  :deep(.v-list.bg-transparent) {
    background-color: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  :deep(.v-card.elevation-3) {
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1) !important;
  }
</style>
