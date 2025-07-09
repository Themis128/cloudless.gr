
<template>
  <div>
    <h1>Debug Tool: {{ type }} / {{ id }}</h1>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const type = route.params.type
const id = route.params.id
</script>
