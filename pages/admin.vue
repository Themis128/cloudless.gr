<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card elevation="6" class="pa-6">
          <v-card-title class="text-h5 mb-4">Admin Dashboard</v-card-title>
          <v-list>
            <v-list-item to="/admin/dashboard">
              <v-list-item-title>Dashboard</v-list-item-title>
            </v-list-item>
            <v-list-item to="/admin/contact-submissions">
              <v-list-item-title>Contact Submissions</v-list-item-title>
            </v-list-item>
            <v-list-item to="/settings">
              <v-list-item-title>Settings</v-list-item-title>
            </v-list-item>
            <v-list-item to="/">
              <v-list-item-title>Back to Home</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'admin-required',
  layout: 'admin'
})
</script>
