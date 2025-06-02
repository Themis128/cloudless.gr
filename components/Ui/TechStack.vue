<template>
  <v-container fluid class="tech-stack-page d-flex align-center justify-center pa-8">
    <v-card
      elevation="4"
      rounded="xl"
      class="tech-stack-card text-center"
      max-width="400"
      :color="cardColor"
      hover
    >
      <v-card-text class="pa-8">
        <v-card-title class="text-h5 font-weight-bold text-primary mb-6 pa-0">
          Our Tech Stack
        </v-card-title>

        <v-list class="tech-list bg-transparent">
          <v-list-item v-for="tech in techStack" :key="tech" class="tech-item px-0">
            <v-list-item-title class="text-body-1 text-medium-emphasis text-center">
              <v-chip color="primary" variant="tonal" size="default" class="ma-1">
                {{ tech }}
              </v-chip>
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from '#imports';
import { useTheme } from 'vuetify';

interface TechStackProps {
  techStack: string[];
}

withDefaults(defineProps<TechStackProps>(), {
  techStack: () => [],
});

const theme = useTheme();

const cardColor = computed(() => {
  return theme.global.current.value.dark ? 'surface-variant' : 'rgba(255, 255, 255, 0.95)';
});
</script>

<style scoped>
.tech-stack-page {
  min-height: 80vh;
}

.tech-stack-card {
  transition: transform 0.2s ease-in-out;
}

.tech-stack-card:hover {
  transform: translateY(-4px);
}

.tech-list {
  min-height: auto;
}

.tech-item {
  min-height: auto;
  padding: 2px 0;
}
</style>
