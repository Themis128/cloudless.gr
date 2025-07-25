<template>
  <span class="favorite-star" @click="toggleFavorite">
    <span v-if="isFavorite">★</span>
    <span v-else>☆</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Project } from '@/types/projects';
import { defineProps } from 'vue';

const props = defineProps<{ project: any }>();
const localProject = ref({ ...props.project });
const isFavorite = computed(() => localProject.value.isFavorite);

function toggleFavorite() {
  // placeholder: emit an event or update state
  localProject.value.isFavorite = !localProject.value.isFavorite;
}
</script>

<style scoped>
.favorite-star {
  cursor: pointer;
  color: gold;
  font-size: 1.2rem;
}
</style>
