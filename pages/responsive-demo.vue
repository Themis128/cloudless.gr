<!-- 
  responsive-demo.vue
  Page implementing the ResponsiveDemo component
  to showcase the useResponsive composable functionality
-->
<template>
  <div class="responsive-demo-page">
    <v-container class="py-8">
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <h1 class="text-h3 font-weight-bold mb-8 text-center">Responsive Design System</h1>
          <!-- Use the ResponsiveDemo component -->
          <DemoResponsiveDemo />
        </v-col>
      </v-row>
    </v-container>
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