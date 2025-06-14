<template>
  <nav class="hidden md:flex gap-4 items-center">
    <NuxtLink
      v-for="link in links"
      :key="link.path"
      :to="link.path"
      class="nav-link"
      :class="{ active: isActive(link.path) }"
    >
      {{ capitalize(String(link.name)) }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useMainNavLinks } from '@/composables/useMainNavLinks'
import { useRoute } from 'vue-router'

const { links } = useMainNavLinks()
const route = useRoute()

function capitalize(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function isActive(path: string) {
  // Highlight if current route path starts with link path (for nested routes)
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.nav-link {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  color: #374151;
  font-weight: 500;
  transition: background 0.2s, color 0.2s;
  text-decoration: none;
  outline: none;
}
.nav-link:hover,
.nav-link:focus {
  background: #e0e7ff;
  color: #3730a3;
}
.nav-link.active {
  background: #c7d2fe;
  color: #1e3a8a;
  font-weight: 600;
}
</style>
