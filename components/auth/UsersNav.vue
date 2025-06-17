<template>
  <nav class="users-nav">
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="nav-link"
      active-class="active-link"
    >
      <v-icon left size="18">{{ item.icon }}</v-icon>
      <span>{{ item.title }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const navItems = [
  { title: 'Profile', to: '/users/profile', icon: 'mdi-account' },
  { title: 'Projects', to: '/users/projects', icon: 'mdi-folder' },
  { title: 'Settings', to: '/users/settings', icon: 'mdi-cog' },
  { title: 'About', to: '/users/about', icon: 'mdi-information' },
  { title: 'Contact', to: '/users/contact', icon: 'mdi-email' },
]
</script>

<style scoped>
.users-nav {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 0.5rem 0;
}
.nav-link {
  display: flex;
  align-items: center;
  color: #374151;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s;
  font-size: 1.05rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
}
.nav-link:hover, .active-link {
  color: #1976d2;
  background: #e3f2fd;
}
</style>
