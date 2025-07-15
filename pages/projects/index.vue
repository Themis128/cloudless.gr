
<template>
  <ProjectGuide />
  <div class="projects-page">
    <h1>Projects</h1>
    <p>Group and manage your Bots, Models, and Pipelines as Projects.</p>
    <VCard class="my-6" v-if="projects.length === 0">
      <VCardText>No projects found. Create your first project!</VCardText>
    </VCard>
    <div v-else>
      <div class="mb-8">
        <VChart :option="chartOptions" autoresize style="height:320px;" />
      </div>
      <VRow>
        <VCol v-for="project in projects" :key="project.id" cols="12" md="6" lg="4">
          <VCard>
            <VCardTitle>{{ project.name }}</VCardTitle>
            <VCardSubtitle>{{ project.description }}</VCardSubtitle>
            <VCardText>
              <div>Bots: {{ project.bots?.length || 0 }}</div>
              <div>Models: {{ project.models?.length || 0 }}</div>
              <div>Pipelines: {{ project.pipelines?.length || 0 }}</div>
            </VCardText>
            <VCardActions>
              <VBtn :to="`/projects/${project.id}`" color="primary">View</VBtn>
            </VCardActions>
          </VCard>
        </VCol>
      </VRow>
    </div>
    <VBtn color="primary" class="mt-8" @click="showCreate = true">Create Project</VBtn>
    <VDialog v-model="showCreate" max-width="500">
      <VCard>
        <VCardTitle>Create Project</VCardTitle>
        <VCardText>
          <VTextField v-model="newProject.name" label="Project Name" required />
          <VTextarea v-model="newProject.description" label="Description" />
        </VCardText>
        <VCardActions>
          <VBtn color="primary" @click="createProject">Create</VBtn>
          <VBtn text @click="showCreate = false">Cancel</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ProjectGuide from '~/components/step-guides/ProjectGuide.vue'
import VChart from 'vue-echarts'

const projects = ref<Array<{
  id: number
  name: string
  description: string
  bots?: any[]
  models?: any[]
  pipelines?: any[]
}>>([])

const showCreate = ref(false)
const newProject = ref({ name: '', description: '' })

function createProject() {
  if (!newProject.value.name) return
  projects.value.push({
    id: Date.now(),
    name: newProject.value.name,
    description: newProject.value.description,
    bots: [],
    models: [],
    pipelines: []
  })
  showCreate.value = false
  newProject.value = { name: '', description: '' }
}

const chartOptions = computed(() => {
  if (!projects.value.length) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Bots', 'Models', 'Pipelines'] },
    xAxis: {
      type: 'category',
      data: projects.value.map(p => p.name)
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Bots',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: projects.value.map(p => p.bots?.length || 0)
      },
      {
        name: 'Models',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: projects.value.map(p => p.models?.length || 0)
      },
      {
        name: 'Pipelines',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: projects.value.map(p => p.pipelines?.length || 0)
      }
    ]
  }
})

onMounted(() => {
  // Placeholder: load projects from API/store in the future
})
</script>

<style scoped>
.projects-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
</style>
