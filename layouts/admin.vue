<template>
  <v-app>
    <VantaClouds2Background v-if="isEnabled" />

    <v-app-bar
      color="primary"
      dark
      app
      elevation="2"
      class="transparent-overlay"
      :height="mobile ? 56 : 64"
    >
      <v-toolbar-title class="responsive-title">
        <NuxtLink to="/admin/dashboard" class="text-white text-decoration-none">
          <span v-if="!mobile">Admin Dashboard</span>
          <span v-else class="text-h6">Admin</span>
        </NuxtLink>
      </v-toolbar-title>

      <v-spacer />

      <!-- Vanta Background Toggle -->
      <v-btn icon @click="toggleBackground" :title="isEnabled ? 'Hide Clouds' : 'Show Clouds'" class="mr-2">
        <v-icon>{{ isEnabled ? 'mdi-weather-night' : 'mdi-weather-cloudy' }}</v-icon>
      </v-btn>

      <!-- Navigation Menu -->
      <template v-if="!mobile">
        <v-btn
          variant="text"
          class="mr-2"
          to="/admin/dashboard"
          :class="{ 'v-btn--active': route.path === '/admin/dashboard' }"
        >
          <v-icon start>mdi-view-dashboard</v-icon>
          Dashboard
        </v-btn>

        <v-btn
          variant="text"
          class="mr-2"
          to="/admin/contact-submissions"
          :class="{ 'v-btn--active': route.path === '/admin/contact-submissions' }"
        >
          <v-icon start>mdi-email</v-icon>
          Messages
        </v-btn>

        <v-btn
          variant="text"
          class="mr-2"
          to="/admin/settings"
          :class="{ 'v-btn--active': route.path === '/admin/settings' }"
        >
          <v-icon start>mdi-cog</v-icon>
          Settings
        </v-btn>
      </template>

      <!-- User Menu -->      <v-menu offset-y>
        <template #activator="{ props }">
          <v-btn v-bind="props" icon class="ml-2">
            <v-avatar size="32">
              <v-icon>mdi-account-circle</v-icon>
            </v-avatar>
          </v-btn>
        </template>
        <v-list>
          <v-list-item to="/admin/profile">
            <template #prepend>
              <v-icon>mdi-account</v-icon>
            </template>
            <v-list-item-title>Profile</v-list-item-title>
          </v-list-item>
          <v-list-item @click="handleLogout">
            <template #prepend>
              <v-icon>mdi-logout</v-icon>
            </template>
            <v-list-item-title>Logout</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- Mobile Menu -->
      <v-app-bar-nav-icon v-if="mobile" @click="drawer = !drawer"></v-app-bar-nav-icon>
    </v-app-bar>

    <!-- Mobile Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" temporary app class="transparent-overlay">
      <v-list>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          to="/admin/dashboard"
          @click="drawer = false"
        ></v-list-item>

        <v-list-item
          prepend-icon="mdi-email"
          title="Messages"
          to="/admin/contact-submissions"
          @click="drawer = false"
        ></v-list-item>

        <v-list-item
          prepend-icon="mdi-cog"
          title="Settings"
          to="/admin/settings"
          @click="drawer = false"
        ></v-list-item>

        <v-divider class="my-4"></v-divider>

        <v-list-item
          prepend-icon="mdi-account"
          title="Profile"
          to="/admin/profile"
          @click="drawer = false"
        ></v-list-item>

        <v-list-item prepend-icon="mdi-logout" title="Logout" @click="handleLogout"></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main class="responsive-main">
      <v-container
        :class="['content-container', mobile ? 'pa-2' : 'pa-4', mobile ? 'py-4' : 'py-8']"
        :fluid="mobile"
      >
        <slot />
      </v-container>
    </v-main>

    <v-footer app class="footer-transparent responsive-footer">
      <v-container>
        <v-row align="center">
          <v-col cols="12" class="text-center">
            <span class="text-caption">
              © {{ new Date().getFullYear() }} Cloudless.gr Admin Panel
            </span>
          </v-col>
        </v-row>
      </v-container>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import { ref, useRoute, useRouter } from '#imports';
import { useDisplay } from 'vuetify';
import { useVantaBackground } from '@/composables/useVantaBackground';

const { mobile } = useDisplay();
const router = useRouter();
const route = useRoute();

// Mobile drawer state
const drawer = ref(false);

// Use Vanta background toggle functionality
const { isEnabled, toggleBackground } = useVantaBackground();

// Handle logout
const handleLogout = async () => {
  console.log('Logging out...');
  await router.push('/admin/login');
};

// Make mobile accessible in template
defineExpose({
  mobile,
});
</script>

<style scoped>
.transparent-overlay {
  background-color: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.content-container {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border-radius: 12px;
  margin: 16px auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.footer-transparent {
  background-color: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.v-btn--active {
  background-color: rgba(255, 255, 255, 0.2);
}

/* Mobile responsive styles */
@media (max-width: 959px) {
  .content-container {
    margin: 8px;
    border-radius: 8px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .transparent-overlay,
  .content-container,
  .footer-transparent {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
