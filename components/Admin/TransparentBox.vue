<template>
  <!-- White box for content overlay if needed later -->
  <div class="content-overlay">
    <div class="content-inner">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Transparent box component for admin content
</script>

<style>
/* 
.content-overlay {
  background-color: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.content-inner {
  position: relative;
  z-index: 1;
}
*/
</style>
