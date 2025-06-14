<template>
  <v-container class="py-12">
    <h1 class="text-h4 text-center mt-10 text-white">Welcome to the Admin Dashboard 👑</h1>
    <v-row class="mt-6">
      <!-- Section 1: Stats -->
      <v-col cols="12" md="4">
        <v-card class="pa-6" elevation="4">
          <v-card-title class="text-center">Total Users</v-card-title>
          <v-card-text class="text-center">150</v-card-text>
        </v-card>
      </v-col>
      <!-- Section 2: Recent Activity -->
      <v-col cols="12" md="4">
        <v-card class="pa-6" elevation="4">
          <v-card-title class="text-center">Recent Activity</v-card-title>
          <v-card-text>
            <ul>
              <li>User John Doe logged in</li>
              <li>Admin Sarah created a new project</li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
      <!-- Section 3: Notifications -->
      <v-col cols="12" md="4">
        <v-card class="pa-6" elevation="4">
          <v-card-title class="text-center">Notifications</v-card-title>
          <v-card-text>
            <v-alert type="info">New user registered</v-alert>
            <v-alert type="warning">Pending admin approval</v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin'],
  title: 'Admin Dashboard'
})
</script>

<style scoped>
h1 {
  letter-spacing: 1px;
}
</style>
