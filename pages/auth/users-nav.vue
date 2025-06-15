<template>
  <div class="users-nav-wrapper">
    <!-- UserMenu component for user profile options -->
    <UserMenu />

    <!-- Navigation links displayed in the users layout -->
    <nav class="users-nav">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-link"
        active-class="active-link"
        :aria-label="`Navigate to ${item.title}`"
      >
        <v-icon size="18">{{ item.icon }}</v-icon>
        <span>{{ item.title }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import UserMenu from '@/components/auth/UserMenu.vue'

definePageMeta({
  layout: 'user'  // This ensures the page uses the 'user' layout
})

const navItems = [
  { title: 'Profile', to: '/users/profile', icon: 'mdi-account' },
  { title: 'Projects', to: '/users/projects', icon: 'mdi-folder' },
  { title: 'Settings', to: '/users/settings', icon: 'mdi-cog' },
  { title: 'About', to: '/users/about', icon: 'mdi-information' },
  { title: 'Contact', to: '/users/contact', icon: 'mdi-email' }
]
</script>

<style scoped>
/* Wrapper for navigation and user menu */
.users-nav-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
  padding: 1rem; /* Add some padding for better spacing */
  flex-grow: 1;
}

/* Flexbox layout for the navigation items */
.users-nav {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 0.5rem 0;
  flex-wrap: wrap; /* Allow wrapping on small screens */
}

/* Styles for the navigation links */
.nav-link {
  display: flex;
  align-items: center;
  color: #374151;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
  font-size: 1.05rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
}

.nav-link:hover,
.active-link {
  color: #1976d2;
  background: #e3f2fd;
}

/* Adjustments for content layout */
.page-content {
  width: 100%;
  flex-grow: 1;
  padding: 1rem 0;
}

/* Ensure responsive design with wrapping on small screens */
@media (max-width: 600px) {
  .users-nav {
    flex-direction: column; /* Stack vertically on small screens */
    align-items: flex-start;
  }

  .nav-link {
    width: 100%; /* Ensure nav items take full width on small screens */
    text-align: left; /* Align text to the left */
  }
}
</style>
