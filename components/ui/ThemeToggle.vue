<template>
  <v-btn
    icon
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggleTheme"
  >
    <v-icon>{{ isDark ? 'mdi-weather-night' : 'mdi-white-balance-sunny' }}</v-icon>
  </v-btn>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useTheme } from 'vuetify'

const theme = useTheme()
const isDark = computed(() => theme.global.name.value === 'dark')

function toggleTheme() {
  const newTheme = isDark.value ? 'light' : 'dark'
  theme.global.name.value = newTheme
  if (process.client) {
    localStorage.setItem('theme', newTheme)
  }
}

onMounted(() => {
  if (process.client) {
    const saved = localStorage.getItem('theme')
    if (saved) theme.global.name.value = saved
  }
})
</script>
