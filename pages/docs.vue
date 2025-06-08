<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h3 mb-4">Documentation</h1>
          <p class="text-h6 mb-6">Project documentation and guides</p>
          
          <v-card>
            <v-card-title>Available Documentation</v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item>
                  <v-list-item-title>Authentication Guide</v-list-item-title>
                  <v-list-item-subtitle>Complete authentication setup and configuration</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Supabase Setup</v-list-item-title>
                  <v-list-item-subtitle>Database configuration and schema</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Docker Configuration</v-list-item-title>
                  <v-list-item-subtitle>Container setup and deployment</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
// Page meta
definePageMeta({
  title: 'Documentation',
  description: 'Project documentation and guides'
})
</script>
