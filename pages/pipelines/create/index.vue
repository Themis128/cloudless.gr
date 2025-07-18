<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  // Redirect to the first step
  router.replace('/pipelines/create/details')
})
</script>

<template>
  <div>Redirecting...</div>
</template> 