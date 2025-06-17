<template>
  <div>
    <h1>[id]</h1>
    <p>This is the [id] page.</p>
    <NuxtLink to="/">Go Home</NuxtLink>
  </div>
</template>

<script setup>
// [id] page component
const _pageTitle = '[id]'

definePageMeta({
  layout: 'user',
  middleware: 'auth'
})
</script>