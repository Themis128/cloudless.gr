<template>
  <span class="favorite-star" @click="toggleFavorite">
    <span v-if="isFavorite">★</span>
    <span v-else>☆</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Project } from '@/types/projects';
import { defineProps } from 'vue';

const props = defineProps<{ project: Project }>();
const isFavorite = computed(() => props.project.isFavorite);

const emit = defineEmits(['toggle-favorite']);

function toggleFavorite() {
  // emit an event instead of mutating the prop directly
  emit('toggle-favorite', props.project);
}
</script>

<style scoped>
.favorite-star {
  cursor: pointer;
  color: gold;
  font-size: 1.2rem;
}
</style>
