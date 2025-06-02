<template>
  <!-- Desktop Navigation -->
  <div class="d-none d-lg-flex align-center">
    <!-- Navigation Links -->
    <div class="d-flex align-center mr-4">
      <v-btn
        v-for="item in navItems"
        :key="item.text"
        :to="item.link"
        variant="text"
        :class="['nav-btn mx-1', { 'nav-btn-compact': lg && !xl }]"
        :size="xl ? 'default' : 'small'"
      >
        <v-icon v-if="item.icon" :icon="item.icon" class="mr-1" size="small" />
        <span :class="{ 'd-none d-xl-inline': item.hideTextOnLg }">{{ item.text }}</span>
      </v-btn>
    </div>

    <!-- Auth Section -->
    <div class="auth-section d-flex align-center">
      <template v-if="!isLoggedIn">
        <v-btn
          to="/auth/login"
          variant="text"
          class="nav-btn mx-1"
          :size="xl ? 'default' : 'small'"
        >
          <v-icon icon="mdi-login" class="mr-1" size="small" />
          <span class="d-none d-xl-inline">Login</span>
        </v-btn>
        <v-btn
          to="/auth/signup"
          color="primary"
          variant="elevated"
          class="signup-btn mx-1"
          :size="xl ? 'default' : 'small'"
        >
          <v-icon icon="mdi-account-plus" class="mr-1" size="small" />
          <span class="d-none d-xl-inline">Sign Up</span>
        </v-btn>
      </template>

      <!-- User Menu when logged in -->
      <template v-else>
        <v-menu offset-y>
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props" class="user-menu-btn" :size="xl ? 'default' : 'small'">
              <v-avatar :size="xl ? 32 : 28">
                <v-icon icon="mdi-account-circle" />
              </v-avatar>
            </v-btn>
          </template>
          <v-list class="user-menu-list" min-width="200">
            <v-list-item to="/dashboard" prepend-icon="mdi-view-dashboard" class="user-menu-item">
              <v-list-item-title>Dashboard</v-list-item-title>
            </v-list-item>
            <v-list-item to="/profile" prepend-icon="mdi-account" class="user-menu-item">
              <v-list-item-title>Profile</v-list-item-title>
            </v-list-item>
            <v-divider />
            <v-list-item
              @click="handleLogout"
              prepend-icon="mdi-logout"
              class="user-menu-item logout-item"
            >
              <v-list-item-title>Logout</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </div>
  </div>

  <!-- Tablet Navigation (md to lg) -->
  <div class="d-none d-md-flex d-lg-none align-center">
    <v-menu offset-y>
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" variant="text" class="nav-menu-btn" append-icon="mdi-chevron-down">
          <v-icon icon="mdi-menu" class="mr-1" />
          Menu
        </v-btn>
      </template>
      <v-list class="tablet-menu" min-width="240">
        <v-list-item
          v-for="item in navItems"
          :key="item.text"
          :to="item.link"
          :prepend-icon="item.icon"
          class="tablet-menu-item"
        >
          <v-list-item-title>{{ item.text }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-spacer />

    <!-- Tablet Auth Buttons -->
    <div class="d-flex align-center ml-2">
      <template v-if="!isLoggedIn">
        <v-btn to="/auth/login" variant="text" size="small" class="mx-1">
          <v-icon icon="mdi-login" />
        </v-btn>
        <v-btn to="/auth/signup" color="primary" size="small" class="mx-1">
          <v-icon icon="mdi-account-plus" />
        </v-btn>
      </template>
      <template v-else>
        <v-menu offset-y>
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props" size="small">
              <v-avatar size="28">
                <v-icon icon="mdi-account-circle" />
              </v-avatar>
            </v-btn>
          </template>
          <v-list min-width="180">
            <v-list-item to="/dashboard" prepend-icon="mdi-view-dashboard">
              <v-list-item-title>Dashboard</v-list-item-title>
            </v-list-item>
            <v-list-item to="/profile" prepend-icon="mdi-account">
              <v-list-item-title>Profile</v-list-item-title>
            </v-list-item>
            <v-divider />
            <v-list-item @click="handleLogout" prepend-icon="mdi-logout">
              <v-list-item-title>Logout</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from '#imports';
  import { useRouter } from 'vue-router';
  import { useDisplay } from 'vuetify';
  import { useAuth } from '~/composables/useAuth';

  interface NavItem {
    text: string;
    link: string;
    icon?: string;
    hideTextOnLg?: boolean;
  }

  const router = useRouter();
  const { lg, xl } = useDisplay();

  // Use Auth0 authentication
  const { isAuthenticated, logout } = useAuth();

  // Computed auth state to prevent reactive issues
  const isLoggedIn = computed(() => isAuthenticated.value);

  const navItems: NavItem[] = [
    {
      text: 'Home',
      link: '/',
      icon: 'mdi-home',
      hideTextOnLg: false,
    },
    {
      text: 'Projects',
      link: '/projects',
      icon: 'mdi-folder-multiple',
      hideTextOnLg: false,
    },
    {
      text: 'About',
      link: '/about',
      icon: 'mdi-information',
      hideTextOnLg: true,
    },
    {
      text: 'Contact',
      link: '/contact',
      icon: 'mdi-email',
      hideTextOnLg: true,
    },
    {
      text: 'Codegen',
      link: '/codegen',
      icon: 'mdi-code-braces',
      hideTextOnLg: false,
    },
    {
      text: 'FAQ',
      link: '/faq',
      icon: 'mdi-help-circle',
      hideTextOnLg: true,
    },
  ];

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      await router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
</script>

<style scoped>
  /* Navigation Buttons */
  .nav-btn {
    color: white !important;
    text-transform: none;
    font-weight: 500;
    letter-spacing: 0.025em;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    transition: all 0.3s ease;
    border-radius: 8px;
    min-height: 40px;
  }

  .nav-btn:hover {
    background: rgba(255, 255, 255, 0.1) !important;
    transform: translateY(-1px);
  }

  .nav-btn-compact {
    padding: 0 8px !important;
    min-width: auto !important;
  }

  /* Auth Section */
  .auth-section {
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    padding-left: 16px;
    margin-left: 8px;
  }

  .signup-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    text-transform: none;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .signup-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  /* User Menu */
  .user-menu-btn {
    border-radius: 50%;
    transition: all 0.3s ease;
  }

  .user-menu-btn:hover {
    background: rgba(255, 255, 255, 0.1) !important;
    transform: scale(1.05);
  }

  .user-menu-list {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .user-menu-item {
    transition: background-color 0.2s ease;
  }

  .user-menu-item:hover {
    background: rgba(103, 126, 234, 0.1) !important;
  }

  .logout-item:hover {
    background: rgba(244, 67, 54, 0.1) !important;
  }

  /* Tablet Navigation */
  .nav-menu-btn {
    color: white !important;
    text-transform: none;
    font-weight: 500;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    border-radius: 8px;
  }

  .tablet-menu {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .tablet-menu-item {
    transition: background-color 0.2s ease;
    min-height: 48px;
  }

  .tablet-menu-item:hover {
    background: rgba(103, 126, 234, 0.1) !important;
  }

  /* Responsive adjustments */
  @media (max-width: 1263px) {
    .nav-btn {
      padding: 0 12px !important;
      font-size: 0.875rem;
    }

    .auth-section {
      padding-left: 12px;
      margin-left: 6px;
    }
  }

  @media (max-width: 959px) {
    .nav-menu-btn {
      font-size: 0.875rem;
      padding: 0 12px !important;
    }
  }

  /* Touch device optimizations */
  @media (hover: none) and (pointer: coarse) {
    .nav-btn,
    .nav-menu-btn,
    .user-menu-btn {
      min-height: 44px;
      min-width: 44px;
    }

    .user-menu-item,
    .tablet-menu-item {
      min-height: 52px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .nav-btn {
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .user-menu-list,
    .tablet-menu {
      border: 2px solid rgba(0, 0, 0, 0.3);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .nav-btn,
    .signup-btn,
    .user-menu-btn,
    .nav-menu-btn,
    .user-menu-item,
    .tablet-menu-item {
      transition: none;
    }
  }
</style>
