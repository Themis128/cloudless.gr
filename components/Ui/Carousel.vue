<template>
  <div class="carousel">
    <p v-if="!items.length">Carousel component goes here.</p>
    <ul v-else>
      <li v-for="(item, idx) in items" :key="idx">{{ item }}</li>
    </ul>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

defineProps({
  items: {
    type: Array,
    default: () => []
  }
});
const reply = ref('')

function sendReply() {
  // You can emit an event or handle the reply as needed
  // For now, just log it
  console.log('User reply:', reply.value)
  showReply.value = false
  reply.value = ''
}
</script>

<style scoped>
.carousel {
  width: 100%;
  overflow: hidden;
}
</style>

<style scoped>
.carousel {
  width: 100%;
  overflow: hidden;
}
.carousel-reply-textarea {
  width: 100%;
  margin-top: 1rem;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 1rem;
}
.carousel-reply-btn {
  margin-top: 0.5rem;
  padding: 0.4rem 1.2rem;
  border-radius: 6px;
  background: #007bff;
  color: #fff;
  border: none;
  cursor: pointer;
}
</style>
