<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900">
    <div class="container mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">
          Admin Settings
        </h1>
        <p class="text-slate-300">
          Configure system settings and preferences
        </p>
      </div>

      <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 class="text-xl font-bold text-white mb-4">System Configuration</h3>
        <p class="text-slate-300 mb-4">
          This page will contain system configuration options.
        </p>
        
        <v-btn
          color="green"
          variant="outlined"
          @click="navigateTo('/admin')"
        >
          <v-icon left>mdi-arrow-left</v-icon>
          Back to Admin Dashboard
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'admin',
  layout: 'admin'
})
</script>
