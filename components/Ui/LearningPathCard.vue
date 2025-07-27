<template>
  <v-card
    class="learning-path-card"
    elevation="2"
    hover
    @click="$emit('click')"
  >
    <v-card-text class="pa-4">
      <div class="d-flex align-center mb-3">
        <v-icon
          :icon="path.icon"
          color="primary"
          size="24"
          class="mr-3"
        />
        <h3 class="text-h6 font-weight-medium">
          {{ path.title }}
        </h3>
      </div>
      
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{ path.description }}
      </p>
      
      <div class="learning-steps">
        <h4 class="text-subtitle-2 font-weight-medium mb-2">Learning Steps:</h4>
        <v-list density="compact" class="pa-0 bg-transparent">
          <v-list-item
            v-for="(step, index) in path.steps"
            :key="index"
            class="pa-0 mb-1"
          >
            <template #prepend>
              <v-avatar size="20" color="primary" class="mr-2">
                <span class="text-caption font-weight-bold">{{ index + 1 }}</span>
              </v-avatar>
            </template>
            <v-list-item-title class="text-body-2">
              {{ step }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface LearningPath {
  id: string
  title: string
  description: string
  icon: string
  steps: string[]
}

interface Props {
  path: LearningPath
}

defineProps<Props>()
defineEmits<{
  click: []
}>()
</script>

<style scoped>
.learning-path-card {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  height: 100%;
}

.learning-path-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.learning-steps {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-top: 16px;
}
</style>
