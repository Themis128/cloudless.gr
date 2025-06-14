<template>
  <v-btn icon @click="toggleTheme">
    <v-icon>{{ isDark ? 'mdi-weather-night' : 'mdi-white-balance-sunny' }}</v-icon>
  </v-btn>
</template>

<script setup>
import { ref } from 'vue'
const isDark = ref(false)
function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}
</script>
