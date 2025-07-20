<template>
  <v-alert
    type="info"
    border="start"
    variant="tonal"
    class="mb-4"
  >
    <template #title>
      <strong>Model Deployment Guide</strong>
    </template>
    <div class="mt-2">
      <p class="mb-2">
        Deploy your models with the following steps:
      </p>
      <ul class="mb-0">
        <li><strong>Select Model:</strong> Choose the model you want to deploy</li>
        <li><strong>Deployment Name:</strong> Give your deployment a descriptive name</li>
        <li><strong>Environment:</strong> Choose deployment environment (dev/staging/prod)</li>
        <li><strong>Instance Type:</strong> Select the compute resources needed</li>
        <li><strong>Replicas:</strong> Set the number of model instances</li>
      </ul>
    </div>
  </v-alert>
</template>

<script setup lang="ts">
// Model deployment guide component
</script>
