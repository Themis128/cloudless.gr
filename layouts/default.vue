<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900">
    <header class="py-6 shadow bg-white">
      <div class="container mx-auto flex items-center justify-between">
        <span class="font-bold text-xl tracking-tight text-indigo-700">Cloudless</span>
        <slot name="header" />
      </div>
    </header>
    <main class="container mx-auto px-4 py-8">
      <slot />
    </main>
    <footer class="py-4 text-center text-gray-500 bg-white border-t mt-8">
      &copy; {{ year }} Cloudless. All rights reserved.
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup>
const year = new Date().getFullYear();
// Layout-level logic if needed
</script>

<style>
/* You can add global layout styles here if needed */
</style>
