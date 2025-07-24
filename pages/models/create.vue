<template>
  <div>
    <LayoutPageStructure
      title="Create Model"
      subtitle="Build and configure your AI model"
      back-button-to="/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <ModelsModelBuilder />
      </template>

      <template #sidebar>
        <ModelGuide />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useModelStore } from '~/stores/modelStore'

const modelStore = useModelStore()

onMounted(() => {
  // Reset the builder when entering the create page
  modelStore.resetBuilder()
})
</script>
