<template>
  <div class="project-config-page">
    <v-container>
      <h1 class="text-h4 font-weight-bold mb-4">Project Configuration</h1>
      <v-row>
        <v-col cols="12" md="6">
          <ProjectMetadataForm v-model="config.metadata" />
        </v-col>
        <v-col cols="12" md="6">
          <DatasetConfigForm v-model="config.dataset" />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="6">
          <ModelDefaultsForm v-model="config.modelDefaults" />
        </v-col>
        <v-col cols="12" md="6">
          <EnvironmentConfigForm v-model="config.environment" />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <SecretsManager v-model="config.secrets" />
        </v-col>
      </v-row>
      <v-btn
        color="primary"
        class="mt-4"
        :loading="saving"
        @click="saveConfig"
      >Save Configuration</v-btn>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'projects', middleware: 'auth' })
import DatasetConfigForm from '@/components/projects/DatasetConfigForm.vue';
import EnvironmentConfigForm from '@/components/projects/EnvironmentConfigForm.vue';
import ModelDefaultsForm from '@/components/projects/ModelDefaultsForm.vue';
import ProjectMetadataForm from '@/components/projects/ProjectMetadataForm.vue';
import SecretsManager from '@/components/projects/SecretsManager.vue';
import { useProjectsStore } from '@/stores/projectsStore';
import { ref } from 'vue';

const route = useRoute();
const projectsStore = useProjectsStore();
const saving = ref(false);

// Example initial config structure
const config = ref({
  metadata: {
    name: '',
    description: '',
    tags: [],
  },
  dataset: {
    source: '',
    features: [],
    target: '',
    preprocessing: false,
  },
  modelDefaults: {
    algorithm: '',
    epochs: 10,
    learningRate: 0.001,
    batch_size: 32,
    earlyStopping: false,
  },
  environment: {
    instanceType: '',
    autoScaling: false,
    minInstances: 1,
    maxInstances: 1,
  },
  secrets: {},
});

const saveConfig = async () => {
  saving.value = true;
  try {
    const projectId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id;
    await projectsStore.updateProject(projectId, { config: config.value });
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.project-config-page {
  min-height: 60vh;
  color: #fff;
}
</style>
