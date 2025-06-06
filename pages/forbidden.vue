<template>
  <div class="forbidden-page">
    <v-container class="fill-height" fluid>
      <v-row align="center" justify="center">
        <v-col cols="12" sm="8" md="6">
          <v-card class="elevation-12">
            <v-card-title class="text-h4 text-center pa-6">
              <v-icon icon="mdi-shield-alert" size="large" class="mr-2" />
              Access Forbidden
            </v-card-title>
            <v-card-text class="text-center pa-6">
              <p class="text-h6 mb-4">403 - Forbidden</p>
              <p class="text-body-1 mb-4">
                You don't have permission to access this resource.
              </p>
              <p class="text-body-2 text-medium-emphasis">
                If you believe this is an error, please contact the administrator.
              </p>
            </v-card-text>
            <v-card-actions class="justify-center pa-6">
              <v-btn 
                color="primary" 
                variant="elevated" 
                @click="$router.push('/')"
                prepend-icon="mdi-home"
              >
                Go Home
              </v-btn>
              <v-btn 
                color="secondary" 
                variant="outlined" 
                @click="$router.go(-1)"
                prepend-icon="mdi-arrow-left"
              >
                Go Back
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
// Set page meta
definePageMeta({
  layout: 'default',
  title: 'Access Forbidden'
})

// Set head
useHead({
  title: '403 - Access Forbidden',
  meta: [
    { name: 'description', content: 'Access to this resource is forbidden.' }
  ]
})
</script>

<style scoped>
.forbidden-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-card {
  border-radius: 16px;
}
</style>