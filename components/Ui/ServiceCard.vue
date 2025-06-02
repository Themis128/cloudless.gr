<template>
  <v-container fluid class="service-card-page d-flex align-center justify-center pa-8">
    <v-card
      elevation="4"
      rounded="xl"
      class="service-card text-center"
      max-width="400"
      :color="cardColor"
      hover
    >
      <v-card-text class="pa-8">
        <v-card-title class="text-h5 font-weight-bold text-primary mb-4 pa-0">
          {{ title }}
        </v-card-title>

        <p v-if="description" class="text-body-1 text-medium-emphasis">
          {{ description }}
        </p>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from '#imports';
import { useTheme } from 'vuetify';

interface ServiceCardProps {
  title: string;
  description?: string;
}

withDefaults(defineProps<ServiceCardProps>(), {
  description: '',
});

const theme = useTheme();

const cardColor = computed(() => {
  return theme.global.current.value.dark ? 'surface-variant' : 'rgba(255, 255, 255, 0.95)';
});
</script>

<style scoped>
.service-card-page {
  min-height: 80vh;
}

.service-card {
  transition: transform 0.2s ease-in-out;
}

.service-card:hover {
  transform: translateY(-4px);
}
</style>
