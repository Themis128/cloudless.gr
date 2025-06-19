<template>
  <!-- Navigation links removed per user request -->
  <nav class="flex md:hidden gap-2 items-center">
    <!-- All nav-links have been removed -->
  </nav>
</template>

<script setup lang="ts">
// Navigation links removed per user request
// No logic needed since nav-links are not displayed
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
.nav-link:hover,
.nav-link:focus {
  background: #e0e7ff;
  color: #3730a3;
}
.active-link {
  background: #e0e7ff;
  color: #1e3a8a;
  font-weight: 600;
}
</style>
