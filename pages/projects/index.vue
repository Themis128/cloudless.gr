<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="elevation-2">
          <v-card-title class="text-h6">Projects</v-card-title>
          <v-card-text>
            <v-alert type="info" border="start" variant="outlined">
              Page under construction...
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Projects require authentication
definePageMeta({
  // No explicit middleware needed - auth.global.ts handles authentication automatically
})

// Future composables or logic here
// const { projects } = useProjects()
</script>
