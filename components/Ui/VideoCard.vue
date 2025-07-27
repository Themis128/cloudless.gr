<template>
  <v-card
    class="video-card"
    elevation="2"
    hover
    @click="$emit('click')"
  >
    <div class="video-thumbnail">
      <v-icon
        icon="mdi-play-circle"
        size="48"
        color="white"
        class="play-icon"
      />
    </div>
    
    <v-card-text class="pa-4">
      <h3 class="text-h6 font-weight-medium mb-2">
        {{ video.title }}
      </h3>
      
      <p class="text-body-2 text-medium-emphasis mb-3">
        {{ video.description }}
      </p>
      
      <div class="d-flex justify-space-between align-center">
        <div class="d-flex align-center">
          <v-icon icon="mdi-clock-outline" size="16" class="mr-1" />
          <span class="text-caption">{{ video.duration }}</span>
        </div>
        <div class="d-flex align-center">
          <v-icon icon="mdi-eye-outline" size="16" class="mr-1" />
          <span class="text-caption">{{ video.views }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Video {
  id: string
  title: string
  description: string
  duration: string
  views: string
}

interface Props {
  video: Video
}

defineProps<Props>()
defineEmits<{
  click: []
}>()
</script>

<style scoped>
.video-card {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.video-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.video-thumbnail {
  position: relative;
  height: 160px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px 8px 0 0;
}

.play-icon {
  opacity: 0.9;
  transition: all 0.2s ease-in-out;
}

.video-card:hover .play-icon {
  opacity: 1;
  transform: scale(1.1);
}
</style>
