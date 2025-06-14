<template>
  <v-app-bar app color="primary" dark>
    <v-toolbar-title>Cloudless</v-toolbar-title>
    <v-spacer />
    <NuxtLink to="/dashboard">
      <v-btn text>Dashboard</v-btn>
    </NuxtLink>
    <NuxtLink to="/projects">
      <v-btn text>Projects</v-btn>
    </NuxtLink>
    <NuxtLink to="/settings">
      <v-btn text>Settings</v-btn>
    </NuxtLink>
    <NuxtLink to="/auth/login">
      <v-btn text>Login</v-btn>
    </NuxtLink>
  </v-app-bar>
</template>

<script setup>
// Add any needed logic here
</script>
