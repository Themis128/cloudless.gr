<template>
  <v-card class="project-card">
    <v-card-title>{{ project.project_name }}</v-card-title>
    <v-card-text>
      <p>{{ project.overview }}</p>
    </v-card-text>
    <v-card-actions>
      <v-btn
        v-if="project.github_url"
        :href="project.github_url"
        target="_blank"
        color="primary"
        variant="text"
      >
        GitHub
      </v-btn>
      <v-btn
        v-if="project.live_url"
        :href="project.live_url"
        target="_blank"
        color="primary"
        variant="text"
      >
        Live
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
  interface Project {
    project_name: string;
    overview: string;
    github_url?: string;
    live_url?: string;
  }

  defineProps<{
    project: Project;
  }>();
</script>

<style scoped>
  .project-card {
    background: rgba(255, 255, 255, 0.85) !important;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .project-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.12) !important;
  }
</style>
