<template>
  <v-container fluid>
    <v-row class="my-6">
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title class="text-h5">Welcome to Cloudless</v-card-title>
          <v-card-text>
            Your all-in-one low-code platform for data pipelines, analytics, and AI.
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card color="primary" dark>
          <v-card-title>Quick Actions</v-card-title>
          <v-card-text>
            <v-btn block class="mb-2" to="/projects/create">Create Project</v-btn>
            <v-btn block class="mb-2" to="/pipelines/create">New Data Pipeline</v-btn>
            <v-btn block class="mb-2" to="/llm/train">Train LLM</v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Recent Projects</v-card-title>
          <v-card-text>
            <!-- Placeholder for recent project list -->
            <project-list-preview />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Recent Activity</v-card-title>
          <v-card-text>
            <!-- Placeholder for logs, events, or activity -->
            <activity-feed />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// You can import composables or fetch initial data here
</script>
