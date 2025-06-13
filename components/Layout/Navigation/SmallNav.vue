<template>
  <nav class="flex md:hidden gap-2 items-center">
    <NuxtLink
      v-for="link in links"
      :key="link.path"
      :to="link.path"
      class="nav-link"
    >
      {{ link.name.charAt(0).toUpperCase() + link.name.slice(1) }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useMainNavLinks } from '@/composables/useMainNavLinks'
const { links } = useMainNavLinks()
</script>

<style scoped>
.nav-link {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  color: #374151;
  font-weight: 500;
  transition: background 0.2s;
  font-size: 0.95rem;
  text-decoration: none;
  outline: none;
}
.nav-link:hover, .nav-link:focus {
  background: #e0e7ff;
  color: #3730a3;
}
</style>
