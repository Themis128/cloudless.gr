<template>
  <v-card class="sidebar-card">
    <v-card-title class="sidebar-card-title">
      <v-icon v-if="icon" start :color="iconColor">
        {{ icon }}
      </v-icon>
      {{ title }}
    </v-card-title>
    <v-card-text>
      <slot />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Props {
  title: string
  icon?: string
  iconColor?: string
}

withDefaults(defineProps<Props>(), {
  icon: '',
  iconColor: 'primary'
})
</script>

<style scoped>
.sidebar-card {
  background: rgba(255, 255, 255, 0.025);
  backdrop-filter: blur(26px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.025);
  overflow: hidden;
  transition: all 0.3s ease;
}

.sidebar-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
}

.sidebar-card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #000000;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
  padding: 1.25rem 1.25rem 0.75rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(248, 250, 252, 0.04) 100%);
  backdrop-filter: blur(13px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.025);
}

@media (max-width: 768px) {
  .sidebar-card-title {
    font-size: 1rem;
    padding: 1rem 1rem 0.5rem;
  }
}
</style> 