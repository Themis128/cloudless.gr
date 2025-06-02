<template>
  <v-card
    elevation="3"
    rounded="lg"
    class="project-card d-flex flex-column"
    :color="cardColor"
    hover
  >
    <v-card-title class="text-h6 font-weight-bold text-primary">
      {{ project.project_name }}
    </v-card-title>

    <v-card-text class="flex-grow-1">
      <p class="text-body-1 text-medium-emphasis">
        {{ project.overview }}
      </p>
    </v-card-text>

    <v-card-actions class="pa-4 pt-0">
      <v-btn
        v-if="project.github_url"
        :href="project.github_url"
        target="_blank"
        variant="outlined"
        color="primary"
        size="small"
        prepend-icon="mdi-github"
        class="me-2"
      >
        GitHub
      </v-btn>

      <v-btn
        v-if="project.live_url"
        :href="project.live_url"
        target="_blank"
        variant="elevated"
        color="primary"
        size="small"
        prepend-icon="mdi-open-in-new"
      >
        Live Demo
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from '#imports';
import { useTheme } from 'vuetify';

interface Project {
  project_name: string;
  overview: string;
  github_url?: string;
  live_url?: string;
}

defineProps<{
  project: Project;
}>();

const theme = useTheme();

const cardColor = computed(() => {
  return theme.global.current.value.dark ? 'surface-variant' : 'rgba(255, 255, 255, 0.85)';
});
</script>

<style scoped>
.project-card {
  min-width: 260px;
  max-width: 340px;
  height: 100%;
  transition: transform 0.2s ease-in-out;
}

.project-card:hover {
  transform: translateY(-2px);
}
</style>
