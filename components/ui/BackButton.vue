<template>
  <v-btn 
    icon 
    class="mb-4" 
    :to="to || '/'"
    :color="color || 'default'"
    :size="size || 'default'"
  >
    <v-icon>mdi-arrow-left</v-icon>
  </v-btn>
</template>

<script setup lang="ts">
defineProps<{
  to?: string
  color?: string
  size?: string
}>()
</script> 