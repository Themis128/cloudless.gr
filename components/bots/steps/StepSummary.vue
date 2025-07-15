<template>
  <v-list>
    <v-list-item><strong>Name:</strong> {{ form.name }}</v-list-item>
    <v-list-item><strong>Prompt:</strong> {{ form.prompt }}</v-list-item>
    <v-list-item><strong>Model:</strong> {{ form.model }}</v-list-item>
    <v-list-item><strong>Memory Context:</strong> {{ form.memory }}</v-list-item>
    <v-list-item><strong>Tools:</strong> {{ form.tools }}</v-list-item>
  </v-list>
</template>

<script setup lang="ts">
const props = defineProps<{
  form: any
}>()
</script>
