<template>
  <footer class="footer w-full text-center py-2 text-gray-700 text-sm bg-transparent">
    © {{ year }} <b>Cloudless.gr</b> — All rights reserved.
  </footer>
</template>

<script setup lang="ts">
const props = defineProps({ year: { type: Number, required: true } });
</script>

<style scoped>
.footer {
  font-family: inherit;
  background: transparent;
  min-height: 32px;
  line-height: 1.2;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  position: relative;
  width: 100%;
  box-sizing: border-box;
}
@media (max-width: 640px) {
  .footer {
    font-size: 0.85rem;
    padding-top: 0.15rem;
    padding-bottom: 0.15rem;
  }
}
</style>
