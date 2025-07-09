<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h5">Debug Dashboard</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="4">
                <v-btn block color="primary" to="/debug/auth">Auth Debug</v-btn>
              </v-col>
              <v-col cols="12" md="4">
                <v-btn block color="primary" to="/debug/pipeline">Pipeline Debug</v-btn>
              </v-col>
              <v-col cols="12" md="4">
                <v-btn block color="primary" to="/debug/model">Model Debug</v-btn>
              </v-col>
              <v-col cols="12" md="4">
                <v-btn block color="primary" to="/debug/network">Network Debug</v-btn>
              </v-col>
              <v-col cols="12" md="4">
                <v-btn block color="primary" to="/debug/logs">System Logs</v-btn>
              </v-col>
            </v-row>
            <div class="mt-6">System health, metrics, and diagnostic summaries will appear here.</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Add composables or logic for dashboard metrics here
</script>
