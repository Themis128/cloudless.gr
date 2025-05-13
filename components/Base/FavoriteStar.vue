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

function toggleFavorite() {
  // placeholder: emit an event or update state
  props.project.isFavorite = !props.project.isFavorite;
}
</script>

<style scoped>
.favorite-star {
  cursor: pointer;
  color: gold;
  font-size: 1.2rem;
}
</style>
