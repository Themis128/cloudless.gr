<template>  <v-container
  fluid
  class="fill-height d-flex flex-column justify-center align-center text-center hero-content"
>
  <h1 class="text-h3 text-md-h1 font-weight-bold mb-4">
    Cloudless: Power Without the Code
  </h1>

  <p class="text-subtitle-1 text-md-h5 mb-6 mx-auto" style="max-width: 600px;">
    Run powerful analytics and cloud workflows with clicks, not code.
    Built for creators, not engineers.
  </p>    <div class="d-flex flex-wrap justify-center">    <!-- Try It Free button, routes to /auth (auth/index.vue) -->
    <NuxtLink to="/auth" class="text-decoration-none">
      <v-btn
        color="primary"
        size="large"
        class="ma-2 px-6 py-3"
        aria-label="Start using Cloudless"
      >
        Try It Free
      </v-btn>
    </NuxtLink><!-- Learn More button, routes to /info/index.vue -->
    <v-btn
      variant="outlined"
      color="white"
      size="large"
      class="ma-2 px-6 py-3"
      aria-label="Learn more about Cloudless"
      @click="goToInfo"
    >        Learn More
    </v-btn>
  </div>

  <!-- Simple Tree Demo Section -->
  <div class="mt-8 tree-demo-section">
    <SimpleTree />
  </div>
</v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const _goToAuth = () => {
  console.log('Navigating to /auth')
  navigateTo('/auth')
}

const goToInfo = () => {
  console.log('Navigating to /info')
  navigateTo('/info')
}
</script>

<style scoped>
.hero-content {
  position: relative;
  z-index: 2;
  color: white;
  padding-block: 6rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
}

.v-btn {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.v-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

.tree-demo-section {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 100%;
}

.tree-demo-section :deep(.simple-tree h3) {
  color: #333;
  margin-bottom: 16px;
}

.tree-demo-section :deep(.tree-container) {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
