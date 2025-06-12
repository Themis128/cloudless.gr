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

html {
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

.v-application {
  font-family: 'Inter', sans-serif;
}
</style>
