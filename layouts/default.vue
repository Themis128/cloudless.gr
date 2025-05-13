<template>
  <div class="layout-root">
    <header class="main-header header-transparent">
      <div class="container mx-auto flex items-center justify-between">
        <NuxtLink to="/" class="font-bold text-xl tracking-tight text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2 py-1 hover:bg-indigo-50 transition">
          Cloudless
        </NuxtLink>
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
</script>

<style>
.layout-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.main-header.header-transparent {
  position: sticky;
  top: 0;
  z-index: 200;
  width: 100%;
  background: transparent;
  box-shadow: none;
  color: transparent;
}
footer {
  flex-shrink: 0;
}
</style>
