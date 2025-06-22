<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900">
    <div class="container mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">
          User Management
        </h1>
        <p class="text-slate-300">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 class="text-xl font-bold text-white mb-4">User Administration</h3>
        <p class="text-slate-300 mb-4">
          This page will contain comprehensive user management tools.
        </p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <v-btn
            color="green"
            variant="outlined"
            @click="navigateTo('/admin')"
          >
            <v-icon left>mdi-arrow-left</v-icon>
            Back to Admin Dashboard
          </v-btn>
          
          <v-btn
            color="blue"
            variant="outlined"
            @click="navigateTo('/sys')"
          >
            <v-icon left>mdi-shield-crown</v-icon>
            System Admin
          </v-btn>
          
          <v-btn
            color="purple"
            variant="outlined"
            @click="navigateTo('/users')"
          >
            <v-icon left>mdi-account</v-icon>
            User Area
          </v-btn>
        </div>
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
