<template>
  <VApp>
    <NuxtLayout>
      <VMain>
        <NuxtPage :transition="pageTransition" />
      </VMain>
    </NuxtLayout>
  </VApp>
</template>

<script setup lang="ts">
import { useHead } from '#imports'

// SEO and meta improvements
useHead({
  title: 'Cloudless.gr - ML Platform',
  titleTemplate: '%s | Cloudless.gr',
  meta: [
    { name: 'description', content: 'Modern machine learning platform for AI development and deployment' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#1976D2' }
  ],
  htmlAttrs: {
    lang: 'en'
  },
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
  ]
})

// Enhanced page transitions
const pageTransition = {
  name: 'fade-page',
  mode: 'out-in',
  duration: 300
}
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  overflow-x: hidden;
  background-color: #7ec0ee;
}

/* Browser compatibility and accessibility enhancements */
button, input, select, textarea {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: none;
  border-radius: 0;
  box-shadow: none;
}

button, [role="button"], input[type="button"], input[type="submit"], .v-btn {
  touch-action: manipulation;
  user-select: none;
  outline: 2px solid #1976d2;
  outline-offset: 2px;
  transition: outline 0.2s;
}

button:focus, [role="button"]:focus, input:focus, select:focus, textarea:focus, .v-btn:focus {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

input, textarea, select {
  user-select: text;
}

.accessibility-btn {
  user-select: none;
}

html {
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

.v-application {
  font-family: 'Inter', sans-serif;
}

/* Global page transition for smooth navigation */
.fade-page-enter-active, .fade-page-leave-active {
  transition: opacity 0.35s cubic-bezier(.4,1.7,.6,.95);
}
.fade-page-enter-from, .fade-page-leave-to {
  opacity: 0;
}
</style>