<template>
  <div class="carousel">
    <p v-if="!items.length">Carousel component goes here.</p>
    <ul v-else>
      <li v-for="(item, idx) in items" :key="idx">{{ item }}</li>
    </ul>
  </div>
</template>

<script setup>
const props = defineProps({
  items: {
    type: Array,
    default: () => []
  }
});
</script>

<style scoped>
.carousel {
  width: 100%;
  overflow: hidden;
}
</style>
