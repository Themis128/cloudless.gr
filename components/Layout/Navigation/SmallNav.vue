<template>
  <nav class="relative z-20 mobile-nav">
    <v-btn
      @click="toggleMenu"
      icon
      class="mobile-menu-btn"
      :size="mobile ? 'small' : 'default'"
      variant="text"
      aria-label="Toggle navigation"
    >
      <v-icon :size="mobile ? 20 : 24">
        {{ isMenuOpen ? 'mdi-close' : 'mdi-menu' }}
      </v-icon>
    </v-btn>

    <!-- Overlay for mobile menu -->
    <v-overlay v-model="isMenuOpen" class="mobile-menu-overlay" @click="closeMenu" />

    <!-- Mobile Menu -->
    <transition name="slide-down">
      <v-card v-if="isMenuOpen" class="mobile-menu-card" elevation="8" rounded="lg">
        <v-list class="py-2" density="comfortable">
          <!-- Navigation Items -->
          <v-list-item
            v-for="item in navItems"
            :key="item.text"
            :to="item.link"
            @click="closeMenu"
            class="mobile-nav-item"
            :prepend-icon="getItemIcon(item.text)"
          >
            <v-list-item-title class="font-weight-medium">
              {{ item.text }}
            </v-list-item-title>
          </v-list-item>

          <v-divider class="my-2" />

          <!-- Authentication Section -->
          <template v-if="!isLoggedIn">
            <v-list-item
              to="/auth/login"
              @click="closeMenu"
              class="mobile-nav-item"
              prepend-icon="mdi-login"
            >
              <v-list-item-title class="font-weight-medium"> Login </v-list-item-title>
            </v-list-item>
            <v-list-item
              to="/auth/signup"
              @click="closeMenu"
              class="mobile-nav-item primary-item"
              prepend-icon="mdi-account-plus"
            >
              <v-list-item-title class="font-weight-medium text-primary">
                Sign Up
              </v-list-item-title>
            </v-list-item>
          </template>

          <template v-else>
            <v-list-item
              to="/dashboard"
              @click="closeMenu"
              class="mobile-nav-item"
              prepend-icon="mdi-view-dashboard"
            >
              <v-list-item-title class="font-weight-medium"> My Dashboard </v-list-item-title>
            </v-list-item>
            <v-list-item
              to="/profile"
              @click="closeMenu"
              class="mobile-nav-item"
              prepend-icon="mdi-account"
            >
              <v-list-item-title class="font-weight-medium"> My Profile </v-list-item-title>
            </v-list-item>
            <v-list-item
              @click="handleLogout"
              class="mobile-nav-item logout-item"
              prepend-icon="mdi-logout"
            >
              <v-list-item-title class="font-weight-medium text-error"> Logout </v-list-item-title>
            </v-list-item>
          </template>
        </v-list>
      </v-card>
    </transition>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, useRouter } from '#imports';
import { useDisplay } from 'vuetify';
import { useAuth } from '~/composables/useAuth';

// Get display breakpoint information using Vuetify 3 composable
const { mobile } = useDisplay();

// Use Auth0 authentication
const { isAuthenticated, logout } = useAuth();
const router = useRouter();

// Computed auth state to prevent reactive issues
const isLoggedIn = computed(() => isAuthenticated.value);

const isMenuOpen = ref(false);
const toggleMenu = () => (isMenuOpen.value = !isMenuOpen.value);
const closeMenu = async () => (isMenuOpen.value = false);

const navItems = [
  { text: 'Home', link: '/', icon: 'mdi-home' },
  { text: 'Projects', link: '/projects', icon: 'mdi-folder-multiple' },
  { text: 'About', link: '/about', icon: 'mdi-information' },
  { text: 'Contact', link: '/contact', icon: 'mdi-email' },
  { text: 'Codegen', link: '/codegen', icon: 'mdi-code-braces' },
  { text: 'FAQ', link: '/faq', icon: 'mdi-help-circle' },
];

const getItemIcon = (text: string): string => {
  const item = navItems.find((item) => item.text === text);
  return item?.icon || 'mdi-circle';
};

const handleLogout = async (): Promise<void> => {
  try {
    await logout();
    await closeMenu();
    await router.push('/');
  } catch (error) {
    console.error('Logout error:', error);
    await closeMenu();
  }
};
</script>

<style scoped>
/* Mobile Navigation Styles */
.mobile-nav {
  position: relative;
}

.mobile-menu-btn {
  color: white !important;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.mobile-menu-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  transform: scale(1.05);
}

.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.mobile-menu-card {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 280px;
  max-width: 320px;
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.mobile-nav-item {
  transition: background-color 0.2s ease;
  min-height: 52px;
}

.mobile-nav-item:hover {
  background: rgba(103, 126, 234, 0.1) !important;
}

.primary-item:hover {
  background: rgba(103, 126, 234, 0.15) !important;
}

.logout-item:hover {
  background: rgba(244, 67, 54, 0.1) !important;
}

/* Slide Down Animation */
.slide-down-enter-active {
  transition: all 0.3s ease-out;
}

.slide-down-leave-active {
  transition: all 0.2s ease-in;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.98);
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .mobile-menu-btn {
    min-height: 44px;
    min-width: 44px;
  }

  .mobile-nav-item {
    min-height: 56px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .mobile-menu-btn {
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .mobile-menu-card {
    border: 2px solid rgba(0, 0, 0, 0.3);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .mobile-menu-btn,
  .mobile-nav-item,
  .slide-down-enter-active,
  .slide-down-leave-active {
    transition: none;
  }
}
</style>
