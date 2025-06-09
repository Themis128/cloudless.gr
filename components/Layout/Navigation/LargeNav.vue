<template>
  <v-app-bar class="large-nav transparent-nav" flat>
    <v-container class="d-flex align-center">
      <v-app-bar-title class="text-h5 font-weight-bold text-white">Cloudless</v-app-bar-title>

      <v-spacer></v-spacer>

      <!-- Navigation Links -->
      <div class="d-none d-md-flex">
        <v-btn
          v-for="item in navItems"
          :key="item.text"
          :to="item.link"
          variant="text"
          class="mx-1 nav-btn"
        >
          {{ item.text }}
        </v-btn>
      </div>
      <!-- Auth Buttons -->
      <template v-if="!authStore.isLoggedIn">
        <v-btn to="/auth/login" variant="text" class="mx-1">Login</v-btn>
        <v-btn to="/auth/signup" color="primary" class="mx-1">Sign Up</v-btn>
      </template>

      <!-- User Menu when logged in -->
      <template v-else>
        <v-menu>
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <v-icon>mdi-account-circle</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item to="/dashboard">
              <v-list-item-title>My Dashboard</v-list-item-title>
            </v-list-item>
            <v-list-item to="/profile">
              <v-list-item-title>My Profile</v-list-item-title>
            </v-list-item>
            <v-list-item @click="handleLogout">
              <v-list-item-title>Logout</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>

      <!-- Mobile menu button -->
      <v-app-bar-nav-icon class="d-md-none" @click="drawer = !drawer"></v-app-bar-nav-icon>
    </v-container>
  </v-app-bar>
  <!-- Mobile Navigation Drawer -->
  <v-navigation-drawer v-model="drawer" temporary class="transparent-drawer">
    <v-list class="transparent-list">
      <v-list-item
        v-for="item in navItems"
        :key="item.text"
        :to="item.link"
        :title="item.text"
        class="nav-item"
      />

      <v-divider class="my-3 transparent-divider" />

      <template v-if="!isLoggedIn">
        <v-list-item to="/auth/login" title="Login" />
        <v-list-item to="/auth/signup" title="Sign Up" />
      </template>
      <template v-else>
        <v-list-item to="/dashboard" title="My Dashboard" />
        <v-list-item to="/profile" title="My Profile" />
        <v-list-item @click="handleLogout" title="Logout" />
      </template>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
  import { ref, useRouter } from '#imports';
  import { useAuthStore } from '~/stores/auth';

  const router = useRouter();
  const authStore = useAuthStore();
  const drawer = ref(false);

  interface NavItem {
    text: string;
    link: string;
  }

  const navItems: NavItem[] = [
    { text: 'Home', link: '/' },
    { text: 'Projects', link: '/projects' },
    { text: 'About', link: '/about' },
    { text: 'Contact', link: '/contact' },
    { text: 'Codegen', link: '/codegen' },
    { text: 'FAQ', link: '/faq' },
  ];
  const handleLogout = async (): Promise<void> => {
    await authStore.logout();
    await router.push('/');
  };
</script>

<style scoped>
  .transparent-nav {
    background: rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nav-btn {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    color: white !important;
  }

  .transparent-drawer {
    background: rgba(255, 255, 255, 0.15) !important;
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }

  .transparent-list {
    background: transparent !important;
  }

  .nav-item {
    background: transparent !important;
    transition: background-color 0.3s ease;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.1) !important;
  }

  .transparent-divider {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.v-list-item) {
    background: transparent !important;
  }

  :deep(.v-list-item:hover) {
    background: rgba(255, 255, 255, 0.1) !important;
  }

  .large-nav {
    display: flex;
    justify-content: space-around;
    background: transparent !important;
    padding: 1rem;
    z-index: 1002 !important;
    position: relative;
  }

  .large-nav ul {
    list-style: none;
    display: flex;
    gap: 1rem;
    background: transparent !important;
  }

  .large-nav a {
    color: white;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    text-decoration: none;
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    font-family: var(--v-theme-font-family);
    transition: color 0.2s;
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    opacity: 1 !important;
    filter: none !important;
  }

  .large-nav a:hover {
    text-decoration: underline;
    color: var(--v-theme-primary);
  }

  .large-nav a:focus {
    outline: none;
    color: var(--v-theme-primary);
  }

  .auth-links {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-left: 1rem;
  }

  .login-btn,
  .profile-btn,
  .dashboard-btn {
    color: white !important;
    padding: 0.375rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .login-btn:hover,
  .profile-btn:hover,
  .dashboard-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .signup-btn,
  .logout-btn {
    color: white !important;
    background: linear-gradient(
      90deg,
      rgb(var(--v-theme-primary)) 0%,
      rgb(var(--v-theme-secondary)) 100%
    );
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }

  .signup-btn:hover,
  .logout-btn:hover {
    background: linear-gradient(
      90deg,
      rgb(var(--v-theme-primary-darken-1)) 0%,
      rgb(var(--v-theme-secondary-darken-1)) 100%
    );
    text-decoration: none;
  }

  .logout-btn {
    font-family: var(--v-theme-font-family);
  }
</style>
