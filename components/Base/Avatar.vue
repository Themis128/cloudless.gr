<template>
  <img :src="src" :alt="alt" class="avatar" />
</template>

<script setup>
const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
});
</script>

<style scoped>
.avatar {
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
}
</style>
