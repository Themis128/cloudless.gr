<template>
  <nav class="flex md:hidden gap-2 items-center">
    <NuxtLink to="/" class="nav-link">Home</NuxtLink>
    <NuxtLink to="/about" class="nav-link">About</NuxtLink>
    <NuxtLink to="/contact" class="nav-link">Contact</NuxtLink>
    <NuxtLink to="/codegen" class="nav-link">Codegen</NuxtLink>
    <NuxtLink to="/faq" class="nav-link">FAQ</NuxtLink>
  </nav>
</template>

<script setup lang="ts">
// No script needed for static nav
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
