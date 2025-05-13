<template>
  <button class="dark-mode-button" @click="toggleDark">
    <span v-if="isDark">🌙</span>
    <span v-else>☀️</span>
  </button>
</template>

<script setup>
import { useDarkModeStore } from '@/stores/useDarkModeStore';
import { computed } from 'vue';

const store = useDarkModeStore();
const isDark = computed(() => store.isDark);

function toggleDark() {
  store.isDark = !store.isDark;
}
</script>

<style scoped>
.dark-mode-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}
</style>
