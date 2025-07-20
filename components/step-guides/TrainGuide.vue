<template>
  <v-alert
    type="info"
    border="start"
    variant="tonal"
    class="mb-4"
  >
    <template #title>
      <strong>Model Training Guide</strong>
    </template>
    <div class="mt-2">
      <p class="mb-2">
        Train your models with the following steps:
      </p>
      <ul class="mb-0">
        <li><strong>Model Name:</strong> Choose a name for your trained model</li>
        <li><strong>Dataset URL:</strong> Provide the URL to your training dataset</li>
        <li><strong>Epochs:</strong> Set the number of training epochs</li>
        <li><strong>Monitor Progress:</strong> Track training performance and results</li>
        <li><strong>Review Results:</strong> Evaluate model performance after training</li>
      </ul>
    </div>
  </v-alert>
</template>

<script setup lang="ts">
// Model training guide component
</script>
