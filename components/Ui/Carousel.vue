<template>
  <div class="carousel">
    <p v-if="!items.length">No certifications found.</p>
    <ul v-else class="carousel-list">
      <li v-for="(item, idx) in items" :key="idx" class="carousel-item">
        <a :href="item.link" target="_blank" rel="noopener" class="carousel-link">
          <img :src="item.image" :alt="item.title" class="carousel-img" />
          <div class="carousel-title">{{ item.title }}</div>
          <div class="carousel-desc">{{ item.description }}</div>
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});
</script>

<style scoped>
.carousel {
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.carousel-list {
  display: flex;
  flex-direction: row;
  gap: 2rem;
  justify-content: center;
  align-items: stretch;
  width: 100%;
  overflow-x: auto;
  padding: 1rem 0;
  list-style: none;
}

.carousel-item {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(30, 41, 59, 0.08);
  padding: 1.5rem 1rem;
  min-width: 220px;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: box-shadow 0.2s;
}

.carousel-item:hover {
  box-shadow: 0 4px 24px rgba(30, 64, 175, 0.18);
}

.carousel-link {
  text-decoration: none;
  color: inherit;
}

.carousel-img {
  width: 90px;
  height: 90px;
  object-fit: contain;
  margin-bottom: 1rem;
}

.carousel-title {
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.carousel-desc {
  font-size: 0.98rem;
  color: #334155;
}
</style>
