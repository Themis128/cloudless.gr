<template>
  <div class="admin-redirect">
    <v-container class="fill-height" fluid>
      <v-row align="center" justify="center">
        <v-col cols="12" sm="8" md="6">
          <v-card class="elevation-12 text-center pa-6">
            <v-progress-circular 
              indeterminate 
              color="primary" 
              size="64"
              class="mb-4"
            />
            <h3 class="text-h5 mb-2">Redirecting to Admin Dashboard...</h3>
            <p class="text-body-2">Please wait while we redirect you.</p>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
// Auto-redirect to admin dashboard
definePageMeta({
  layout: 'admin',
  requiresAdmin: true
})

// Immediately redirect to dashboard
await navigateTo('/admin/dashboard')
</script>

<style scoped>
.admin-redirect {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>
