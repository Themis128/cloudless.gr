<template>
  <nav class="hidden md:flex gap-4 items-center">
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
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  color: #374151;
  font-weight: 500;
  transition: background 0.2s;
  text-decoration: none;
  outline: none;
}
.nav-link:hover, .nav-link:focus {
  background: #e0e7ff;
  color: #3730a3;
}
</style>
