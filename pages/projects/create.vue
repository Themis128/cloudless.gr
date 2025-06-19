<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import ProjectTemplate from '~/data/templates' // Import the correct export for templates

definePageMeta({
  layout: 'projects',
  title: 'Create Project',
  requiresAuth: true,
})

// Get route query
const route = useRoute()
const template_id = route.query.template as string | undefined

// Find the template (if exists)
const selectedTemplate = computed(() =>
  ProjectTemplate.find((t: { id: string }) => t.id === template_id) || null
)

const { createProject } = useCreateProject()
const loading = ref(false)

const handleCreateProject = async (projectData: any) => {
  try {
    loading.value = true
    const project = await createProject(projectData)
    await navigateTo(`/projects/${project.id}`)
  } catch (err) {
    console.error('Failed to create project', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="create-project-page">
    <div class="page-header">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-4"
        @click="navigateTo('/projects')"
      >
        Back to Projects
      </v-btn>

      <div class="header-content">
        <v-avatar size="48" color="success" class="me-4">
          <v-icon icon="mdi-plus-circle" size="24" color="white" />
        </v-avatar>
        <div>
          <h1 class="text-h4 font-weight-bold mb-1">Create New Project</h1>
          <p class="text-body-1 text-medium-emphasis">
            Set up a new ML pipeline project with your preferred configuration
          </p>
        </div>
      </div>
    </div>

    <!-- Create Project Form -->
    <v-card class="create-form-card" elevation="2">
      <v-card-text class="pa-8">
        <ProjectCreateForm
          :loading="loading"
          :initial-template="selectedTemplate"
          @create="handleCreateProject"
          @cancel="navigateTo('/projects')"
        />
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.create-project-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 32px;
}

.header-content {
  display: flex;
  align-items: center;
}

.create-form-card {
  border-radius: 16px;
}
</style>
