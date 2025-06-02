<template>
  <div class="projects-list">
    <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
  </div>
</template>

<script setup lang="ts">
import type { Project } from '~/types/projects';
import ProjectCard from './ProjectCard.vue';

defineProps<{
  projects: Project[];
}>();
</script>
