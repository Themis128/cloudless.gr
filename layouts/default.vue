<template>
  <v-app>
    <!-- The VantaClouds2Background will be rendered behind all content -->
    <VantaClouds2Background />

    <!-- Only show nav if not on /auth/login -->
    <template v-if="$route.path !== '/auth/login'">
      <v-navigation-drawer app permanent>
        <v-list nav>
          <v-list-item to="/" prepend-icon="mdi-view-dashboard" title="Dashboard" />
          <v-list-item to="/builder" prepend-icon="mdi-cube-outline" title="Builder" />
          <v-list-item to="/workflows" prepend-icon="mdi-graph-outline" title="Workflows" />
          <v-list-item to="/projects" prepend-icon="mdi-folder" title="Projects" />
          <v-list-item to="/logs" prepend-icon="mdi-file-document-outline" title="Logs" />
          <v-list-item to="/docs" prepend-icon="mdi-book-open-page-variant-outline" title="Docs" />
        </v-list>
      </v-navigation-drawer>
    </template>

    <v-app-bar
      color="primary"
      dark
      app
      elevation="2"
      class="transparent-overlay"
      :height="mobile ? 56 : 64"
    >
      <v-toolbar-title class="responsive-title">
        <NuxtLink to="/" class="text-white text-decoration-none">
          <span v-if="!mobile">Cloudless</span>
          <span v-else class="text-h6">Cloudless</span>
        </NuxtLink>
      </v-toolbar-title>
      <v-spacer />      <v-btn icon @click="toggleBackground" :title="isEnabled ? 'Hide Clouds' : 'Show Clouds'">
        <v-icon>{{ isEnabled ? 'mdi-weather-night' : 'mdi-weather-cloudy' }}</v-icon>
      </v-btn>
      <LayoutNavigationLargeNav v-if="isDesktop" />
      <LayoutNavigationSmallNav v-else />
      <slot name="header" />
    </v-app-bar>

    <v-main class="responsive-main">
      <v-container
        :class="['content-container', mobile ? 'pa-2' : 'pa-4', mobile ? 'py-4' : 'py-8']"
        :fluid="mobile"
      >
        <slot />
      </v-container>
    </v-main>

    <v-footer app class="footer-transparent responsive-footer">
      <Footer />
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
// Script setup imports
import { computed } from '#imports';
import { useDisplay } from 'vuetify';

// Use Vuetify's built-in responsive utilities
const { mobile, mdAndUp } = useDisplay();
const isDesktop = computed(() => mdAndUp.value);
</script>

<style scoped>
.content-wrapper {
  position: relative;
  z-index: 1;
  height: 100%;
}

.transparent-overlay {
  background-color: rgba(0, 0, 0, 0.2) !important;
  backdrop-filter: blur(5px);
  /* Mobile-first responsive design */
  transition: height 0.3s ease;
  z-index: 1000 !important;
}

.footer-transparent {
  background: transparent !important;
  color: white !important;
  border: none !important;
  backdrop-filter: none !important;
}

.content-container {
  position: relative;
  z-index: 10;
  background-color: transparent !important;
  border-radius: 8px;
  max-width: 100%;
  overflow-x: hidden;
  /* Mobile optimization: prevent horizontal scroll */
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.responsive-main {
  position: relative;
  z-index: 10;
  background: transparent !important;
  background-color: transparent !important;
  /* Mobile-first: ensure proper touch scrolling */
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

.responsive-title {
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* Mobile: Ensure title is readable */
  min-width: 0;
}

.responsive-footer {
  min-height: auto !important;
}

/* Mobile-specific optimizations */
@media (max-width: 599px) {
  .content-container {
    padding-left: 8px !important;
    padding-right: 8px !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .transparent-overlay {
    /* Slightly more opaque on mobile for better readability */
    background-color: rgba(0, 0, 0, 0.3) !important;
  }

  .responsive-title {
    font-size: 1.1rem !important;
  }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .transparent-overlay {
    /* Remove blur on touch devices for better performance */
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

/* High DPI display optimizations */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .responsive-title {
    /* Crisper text on high DPI displays */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

/* Ensure all main containers are transparent to show Vanta background */
:deep(.v-app),
:deep(.v-main),
:deep(.v-container),
:deep(.content-container) {
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

/* Override Vuetify's default app background */
:deep(.v-application) {
  background: transparent !important;
}

/* Ensure the main wrapper is transparent */
.responsive-main {
  background: transparent !important;
  background-color: transparent !important;
}

:deep(.v-card) {
  background-color: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

:deep(.v-card.primary-gradient) {
  background: linear-gradient(
    145deg,
    rgba(239, 246, 255, 0.8),
    rgba(224, 242, 254, 0.8)
  ) !important;
}

:deep(.v-btn) {
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

:deep(.v-list.bg-transparent) {
  background-color: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* Mobile-specific optimizations */
@media (max-width: 599px) {
  .content-container {
    padding-left: 8px !important;
    padding-right: 8px !important;
  }

  :deep(.v-card) {
    margin-bottom: 16px;
    border-radius: 12px;
  }

  :deep(.v-btn) {
    min-width: auto;
    padding: 0 12px;
  }

  :deep(.v-chip) {
    margin: 2px;
    font-size: 0.75rem;
  }
}

/* Tablet optimizations */
@media (min-width: 600px) and (max-width: 959px) {
  :deep(.v-card) {
    border-radius: 16px;
  }
}

/* Touch device optimizations */
@media (pointer: coarse) {
  :deep(.v-btn) {
    min-height: 44px;
    min-width: 44px;
  }

  :deep(.v-list-item) {
    min-height: 48px;
  }
}

.v-navigation-drawer {
  min-width: 220px;
  z-index: 1001 !important;
}

/* Ensure navigation drawer is above Vanta background */
:deep(.v-navigation-drawer) {
  z-index: 1001 !important;
  background-color: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px);
}

/* Ensure app bar is above everything */
:deep(.v-app-bar) {
  z-index: 1002 !important;
}

/* Make navigation drawer and app bar semi-transparent */
:deep(.v-navigation-drawer),
:deep(.v-app-bar) {
  background-color: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(10px);
}

/* Ensure text is readable against the background */
:deep(.v-list-item__title),
:deep(.v-toolbar-title) {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Add a subtle hover effect on navigation items */
:deep(.v-list-item:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* Make the main content area more readable */
:deep(.v-main) {
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}
</style>

<style>
/* Global styles to ensure proper layering */
:deep(.v-navigation-drawer),
:deep(.v-app-bar) {
  background-color: rgba(0, 0, 0, 0.7) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Make text more readable against the dark background */
:deep(.v-list-item__title),
:deep(.v-toolbar-title),
:deep(.v-list-item__prepend > .v-icon) {
  color: rgba(255, 255, 255, 0.87) !important;
}

/* Enhance hover states */
:deep(.v-list-item:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* Style the main content area */
:deep(.v-main) {
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

/* Style text in the main content area */
:deep(.v-main) {
  color: rgba(255, 255, 255, 0.87);
}

/* Make cards semi-transparent */
:deep(.v-card) {
  background-color: rgba(0, 0, 0, 0.7) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Ensure links are visible */
:deep(a:not(.v-btn)) {
  color: #7cb7ff;
}

/* Style buttons to be more visible */
:deep(.v-btn:not(.v-btn--variant-text)) {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
