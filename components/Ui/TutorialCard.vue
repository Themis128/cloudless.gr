<template>
  <v-card
    class="tutorial-card"
    elevation="2"
    hover
    @click="$emit('click')"
  >
    <v-card-text class="pa-4">
      <div class="d-flex align-center mb-3">
        <v-icon
          :icon="tutorial.icon"
          color="primary"
          size="24"
          class="mr-3"
        />
        <div>
          <h3 class="text-h6 font-weight-medium mb-1">
            {{ tutorial.title }}
          </h3>
          <v-chip
            :color="getDifficultyColor(tutorial.difficulty)"
            size="small"
            variant="tonal"
          >
            {{ tutorial.difficulty }}
          </v-chip>
        </div>
      </div>
      
      <p class="text-body-2 text-medium-emphasis mb-3">
        {{ tutorial.description }}
      </p>
      
      <div class="d-flex justify-space-between align-center">
        <div class="d-flex align-center">
          <v-icon icon="mdi-clock-outline" size="16" class="mr-1" />
          <span class="text-caption">{{ tutorial.duration }}</span>
        </div>
        <div class="d-flex align-center">
          <v-icon icon="mdi-eye-outline" size="16" class="mr-1" />
          <span class="text-caption">{{ tutorial.views }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Tutorial {
  id: string
  title: string
  description: string
  icon: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  duration: string
  views: string
  category: string
}

interface Props {
  tutorial: Tutorial
}

defineProps<Props>()
defineEmits<{
  click: []
}>()

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner':
      return 'success'
    case 'Intermediate':
      return 'warning'
    case 'Advanced':
      return 'error'
    default:
      return 'primary'
  }
}
</script>

<style scoped>
.tutorial-card {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.tutorial-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
</style>
