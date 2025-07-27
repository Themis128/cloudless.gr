<template>
  <v-card class="feature-card" elevation="4" @click="handleClick">
    <v-card-text class="pa-6">
      <div class="text-center">
        <v-icon 
          :color="feature.color" 
          size="48" 
          class="mb-4"
        >
          {{ feature.icon }}
        </v-icon>
        <h3 class="text-h6 font-weight-bold mb-3">
          {{ feature.title }}
        </h3>
        <p class="text-body-2 text-medium-emphasis">
          {{ feature.description }}
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Feature {
  id: string
  title: string
  description: string
  icon: string
  color: string
}

interface Props {
  feature: Feature
}

const props = defineProps<Props>()

const handleClick = () => {
  // Handle feature card click if needed
  console.log('Feature clicked:', props.feature.title)
}
</script>

<style scoped>
.feature-card {
  height: 100%;
  transition: all 0.3s ease-in-out;
  cursor: pointer;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
}
</style> 