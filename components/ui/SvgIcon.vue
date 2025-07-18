
<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <template v-if="name === 'bot'">
      <rect width="48" height="48" rx="12" fill="#1976d2" />
      <circle cx="24" cy="24" r="14" fill="#fff" />
      <text x="50%" y="54%" text-anchor="middle" font-size="16" fill="#1976d2" font-family="Arial, Helvetica, sans-serif">Bot</text>
    </template>
    <template v-else-if="name === 'model'">
      <rect width="48" height="48" rx="12" fill="#43a047" />
      <circle cx="24" cy="24" r="14" fill="#fff" />
      <text x="50%" y="54%" text-anchor="middle" font-size="16" fill="#43a047" font-family="Arial, Helvetica, sans-serif">Model</text>
    </template>
    <template v-else-if="name === 'pipeline'">
      <rect width="48" height="48" rx="12" fill="#fbc02d" />
      <circle cx="24" cy="24" r="14" fill="#fff" />
      <text x="50%" y="54%" text-anchor="middle" font-size="16" fill="#fbc02d" font-family="Arial, Helvetica, sans-serif">Pipe</text>
    </template>
    <template v-else-if="name === 'user'">
      <rect width="48" height="48" rx="12" fill="#8e24aa" />
      <circle cx="24" cy="24" r="14" fill="#fff" />
      <text x="50%" y="54%" text-anchor="middle" font-size="16" fill="#8e24aa" font-family="Arial, Helvetica, sans-serif">User</text>
    </template>
    <template v-else>
      <rect width="48" height="48" rx="12" fill="#23232b" />
      <circle cx="24" cy="24" r="14" fill="#fff" />
      <text x="50%" y="54%" text-anchor="middle" font-size="16" fill="#23232b" font-family="Arial, Helvetica, sans-serif">CL</text>
    </template>
  </svg>
</template>

<script setup lang="ts">
// defineProps is a compiler macro and doesn't need to be imported
const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 32 },
})
</script>
