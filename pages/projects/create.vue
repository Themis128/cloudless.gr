<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card>
          <v-card-title>Create Project</v-card-title>
          <v-card-text>
            <div class="mb-4">
              <div>Use the template below to create a new project. Fill in the fields and click 'Create Project'.</div>
              <v-code>
{
  "name": "MyProject",
  "description": "Project description"
}
              </v-code>
            </div>
            <v-form @submit.prevent="createProject" ref="formRef">
              <v-text-field
                v-model="name"
                label="Name"
                placeholder="e.g. MyProject"
                required
                class="mb-3"
              />
              <v-text-field
                v-model="description"
                label="Description"
                placeholder="Project description"
                class="mb-3"
              />
              <v-btn type="submit" color="primary" :loading="loading">Create Project</v-btn>
            </v-form>
            <v-alert v-if="success" type="success" class="mt-3">Project created!</v-alert>
            <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-btn icon class="mb-4" to="/">
      <v-icon>mdi-arrow-left</v-icon>
    </v-btn>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '~/stores/templateStore'
import { storeToRefs } from 'pinia'

const formRef = ref()
const projectStore = useProjectStore()
const { name, description, loading, success, error } = storeToRefs(projectStore)

function createProject() {
  projectStore.create({ name: name.value, description: description.value })
}
</script>

<style scoped>
.mb-3 {
  margin-bottom: 1rem;
}
.mt-3 {
  margin-top: 1rem;
}
</style>
