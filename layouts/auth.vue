<template>
  <div class="auth-layout-bg">
    <VantaClouds2Background />
    <v-app>
      <v-main>
        <slot />
      </v-main>
    </v-app>
  </div>
</template>

<script setup>
// No script needed for basic layout
</script>

<style scoped>
.auth-layout-bg {
  min-height: 100vh;
  width: 100vw;
  position: relative;
  overflow: hidden;
  background: transparent;
}
:deep(.v-main) {
  background: transparent !important;
}
</style>
