<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-title>Cloudless Builder</v-card-title>
          <v-card-text>
            Visually build and configure your infrastructure or apps here.
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>    <v-row>
      <v-col cols="12">
        <AgentsAgentForm />
      </v-col>
    </v-row>
    <!-- Optional: Toolbar for tools, save/load buttons -->
    <v-row>
      <v-col cols="12">
        <v-toolbar flat class="mt-4">
          <v-btn color="primary" variant="outlined" class="mr-2">Save</v-btn>
          <v-btn color="primary" variant="outlined">Load</v-btn>
        </v-toolbar>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Require Pro plan for advanced builder features
definePageMeta({
  requiresPro: true
})

// Future: useProjects, useBuilder composables
</script>
