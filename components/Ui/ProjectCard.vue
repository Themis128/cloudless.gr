<template>
  <div class="project-card">
    <h3>{{ project.project_name }}</h3>
    <p>{{ project.overview }}</p>
    <a v-if="project.github_url" :href="project.github_url" target="_blank" class="project-link">GitHub</a>
    <a v-if="project.live_url" :href="project.live_url" target="_blank" class="project-link">Live</a>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped>
.project-card {
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 0.5rem;
  min-width: 260px;
  max-width: 340px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 12px rgb(80 80 255 / 6%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.project-link {
  margin-right: 1rem;
  color: #2563eb;
  text-decoration: underline;
  font-size: 0.98rem;
}
</style>
