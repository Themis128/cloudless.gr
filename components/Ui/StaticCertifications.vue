<template>
  <div class="d-flex flex-wrap justify-center align-start my-8">
    <div
      v-for="id in badgeIds"
      :key="id"
      class="rounded-xl bg-white/80 shadow pa-2 d-flex align-center justify-center mr-8 mb-8"
      :data-iframe-width="150"
      :data-iframe-height="270"
      :data-share-badge-id="id"
      data-share-badge-host="https://www.credly.com"
    ></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
const badgeIds = [
  '60b2b702-8026-4b0c-abfe-a916c2bb7a22',
  'd27150a6-0e51-4a0e-80eb-d68a8b4640ed',
  '7134faab-e12c-47b8-a6f7-38267999163c',
  '2469758e-3f3c-46a1-bc02-0d69c996db68',
  '87b4538a-02d7-4c12-8d75-4a3cf5baa496',
];
onMounted(() => {
  if (!document.querySelector('script[src*="cdn.credly.com/assets/utilities/embed.js"]')) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://cdn.credly.com/assets/utilities/embed.js';
    document.body.appendChild(script);
  }
});
</script>
