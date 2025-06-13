<template>
  <VApp>
    <NuxtLayout>
      <VMain>
        <NuxtPage />
      </VMain>
    </NuxtLayout>
  </VApp>
</template>

<script setup>
import { useHead } from '#imports'

useHead({
  title: 'Cloudless.gr',
  htmlAttrs: {
    lang: 'en'
  }
})
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
</style>
