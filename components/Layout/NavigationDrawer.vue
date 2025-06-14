<template>
  <v-navigation-drawer app temporary>
    <v-list>
      <NuxtLink to="/dashboard">
        <v-list-item title="Dashboard" prepend-icon="mdi-view-dashboard" />
      </NuxtLink>
      <NuxtLink to="/projects/">
        <v-list-item title="Projects" prepend-icon="mdi-folder" />
      </NuxtLink>
      <NuxtLink to="/settings/">
        <v-list-item title="Settings" prepend-icon="mdi-cog" />
      </NuxtLink>
      <v-divider />
      <NuxtLink to="/auth/login">
        <v-list-item title="Logout" prepend-icon="mdi-logout" />
      </NuxtLink>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup>
// Add logic for drawer state if needed
</script>
