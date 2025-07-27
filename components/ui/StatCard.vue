<template>
  <div class="stat-card">
    <div class="stat-icon">
      <v-icon size="32" color="primary">
        {{ stat.icon }}
      </v-icon>
    </div>
    <div class="stat-content">
      <div class="stat-value">{{ stat.value }}</div>
      <div class="stat-label">{{ stat.label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Stat {
  id: string
  value: string
  label: string
  icon: string
}

interface Props {
  stat: Stat
}

defineProps<Props>()
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  text-align: center;
}

.stat-icon {
  margin-right: 1rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--v-theme-primary);
  line-height: 1;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--v-theme-on-surface-variant);
  line-height: 1.2;
}
</style> 