<template>
  <v-container class="responsive-demo-page">
    <v-row justify="center">
      <v-col cols="12" class="py-8">
        <h1 class="text-h3 font-weight-bold mb-8 text-center">Responsive Design System</h1>
        <v-row justify="center">
          <v-col cols="12" xl="10">
            <!-- Use the ResponsiveDemo component -->
            <DemoResponsiveDemo />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  // The component is auto-imported based on the components directory structure
  // DemoResponsiveDemo maps to components/Demo/ResponsiveDemo.vue

  // Set page title and meta
  useHead({
    title: 'Responsive Design Demo - Cloudless',
    meta: [
      {
        name: 'description',
        content:
          'Demonstration of responsive design patterns and breakpoints in Cloudless applications.',
      },
    ],
  });
</script>
