<template>
  <BaseButton v-bind="$attrs">
    <slot />
  </BaseButton>
</template>

<script setup>
import BaseButton from './BaseButton.vue';
</script>

<style scoped>
/* Additional styles if needed */
</style>
