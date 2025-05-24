<template>
  <div class="relative min-h-screen flex flex-col justify-between overflow-hidden">
    <!-- Background image covering the full page with shadow effect -->
    <img
      src="/images/cloud1.png"
      alt="Cloud background"
      class="fixed inset-0 w-screen h-screen object-cover object-center z-0 select-none pointer-events-none shadow-lg"
      draggable="false"
    />

    <!-- Header -->
    <header class="relative z-20 w-full px-4 sm:px-6 lg:px-8 py-12">
      <h1 class="text-3xl md:text-5xl font-light text-center text-white font-serif italic">
        Empowering the Future of Cloud and Data
      </h1>
      <p class="text-lg md:text-2xl text-center text-gray-300 mt-2 font-light font-serif italic">
        Revolutionizing Web Development, Big Data, and Serverless Applications with Cutting-Edge
        Solutions
      </p>
    </header>
    <!-- Removed local footer to avoid duplicate -->
  </div>
</template>

<script setup lang="ts">
// No JS needed for static background version
</script>

<script lang="ts">
export default {
  layout: 'default',
};
</script>

<style scoped>
/* Ensure the background image covers the full page with shadow effect */
img {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  object-fit: cover;
  z-index: 0;
  pointer-events: none;
  box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.5);
}
</style>
