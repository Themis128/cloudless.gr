<template>
  <v-container
    fluid
    class="fill-height d-flex flex-column justify-center align-center text-center hero-content"
  >
    <h1 class="text-h3 text-md-h1 font-weight-bold mb-4">
      Cloudless: Power Without the Code
    </h1>

    <p class="text-subtitle-1 text-md-h5 mb-6 mx-auto" style="max-width: 600px;">
      Run powerful analytics and cloud workflows with clicks, not code.
      Built for creators, not engineers.
    </p>

    <div class="d-flex flex-wrap justify-center">
      <!-- Try It Free button, routes to /auth (auth/index.vue) -->
      <v-btn
        to="/auth" 
        color="primary"
        size="large"
        class="ma-2 px-6 py-3"
        aria-label="Start using Cloudless"
      >
        Try It Free
      </v-btn>

      <!-- Learn More button, routes to /info/index.vue -->
      <v-btn
        to="/info"
        variant="outlined"
        color="white"
        size="large"
        class="ma-2 px-6 py-3"
        aria-label="Learn more about Cloudless"
      >
        Learn More
      </v-btn>
    </div>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
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
</style>
