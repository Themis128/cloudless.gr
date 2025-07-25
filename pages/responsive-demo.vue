<!-- 
  responsive-demo.vue
  Page implementing the ResponsiveDemo component
  to showcase the useResponsive composable functionality
-->
<template>
  <div class="responsive-demo-page">
    <div class="container mx-auto py-8">
      <h1 class="text-3xl font-bold mb-8 text-center">Responsive Design System</h1>
      <div class="max-w-6xl mx-auto">
        <!-- Use the ResponsiveDemo component -->
        <DemoResponsiveDemo />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// The component is auto-imported based on the components directory structure
// DemoResponsiveDemo maps to components/Demo/ResponsiveDemo.vue
</script>

<style scoped>
.responsive-demo-page {
  min-height: calc(100vh - 80px); /* Adjust based on your header height */
}
</style>