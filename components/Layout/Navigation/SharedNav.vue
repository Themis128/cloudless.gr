<template>
  <!-- Navigation links removed per user request -->
  <nav class="flex gap-2 items-center md:gap-4">
    <!-- All nav-links have been removed -->
  </nav>
</template>

<script setup lang="ts">
// Navigation links removed per user request
// No logic needed since nav-links are not displayed
</script>

<style scoped>
.nav-link {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  color: #374151;
  font-weight: 500;
  transition:
    background 0.2s,
    color 0.2s;
  text-decoration: none;
  outline: none;
}
.nav-link:hover,
.nav-link:focus {
  background: #e0e7ff;
  color: #3730a3;
}
.active-link {
  background: #c7d2fe;
  color: #1e3a8a;
  font-weight: 600;
}
</style>
