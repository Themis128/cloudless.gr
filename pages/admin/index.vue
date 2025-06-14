<template>
  <v-container class="py-12">
    <h2 class="admin-title text-center mb-8">Cloudless Admin Dashboard</h2>
    <v-card class="admin-glass-card pa-8 mx-auto" max-width="600">
      <div class="text-h6 mb-4">Welcome, Admin!</div>
      <div class="mb-2">You are now logged in with admin privileges.</div>
      <v-divider class="my-4" />
      <div class="text-grey">This is your secure admin dashboard. Add admin features here.</div>
    </v-card>
  </v-container>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
</script>

<style scoped>
.admin-title {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 16px rgba(80,80,160,0.13);
}
.admin-glass-card {
  background: rgba(255,255,255,0.10);
  backdrop-filter: blur(14px);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(31,38,135,0.18);
  border: 1.5px solid rgba(168,85,247,0.10);
}
</style>
