<template>
  <v-card class="action-card bg-white mb-4" elevation="2">
    <v-card-title class="d-flex justify-space-between align-center">
      <div class="d-flex align-center">
        <v-icon class="me-3" color="primary" size="24">
          {{ getCardIcon() }}
        </v-icon>
        <div>
          <h3 class="text-h6 font-weight-bold mb-1">{{ title }}</h3>
          <p class="text-body-2 text-medium-emphasis mb-0">{{ subtitle }}</p>
        </div>
      </div>
      <v-progress-circular
        v-if="loading"
        indeterminate
        size="24"
        color="primary"
      />
    </v-card-title>

    <v-card-text class="pt-0">
      <div class="actions-grid">
        <v-btn
          v-for="action in actions"
          :key="action.id"
          :color="action.color"
          :variant="action.variant"
          :size="action.size"
          :disabled="action.disabled || loading"
          :to="action.to"
          :href="action.href"
          class="action-btn"
          @click="handleActionClick(action)"
        >
          <v-icon start>{{ action.icon }}</v-icon>
          {{ action.label }}
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface ActionButton {
  id: string
  label: string
  icon: string
  color: string
  variant: 'elevated' | 'outlined' | 'text' | 'tonal'
  size: 'small' | 'default' | 'large' | 'x-large'
  to?: string
  href?: string
  disabled?: boolean
  onClick?: () => void
}

interface Props {
  title: string
  subtitle: string
  actions: ActionButton[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  actionClick: [action: ActionButton]
}>()

const getCardIcon = () => {
  // Extract icon from first action or use default
  return props.actions[0]?.icon || 'mdi-lightning-bolt'
}

const handleActionClick = (action: ActionButton) => {
  if (action.onClick) {
    action.onClick()
  }
  emit('actionClick', action)
}
</script>

<style scoped>
.action-card {
  transition:
    transform 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out;
  border-radius: 12px;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  align-items: center;
}

.action-btn {
  min-height: 48px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 8px;
  text-transform: none;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .actions-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .action-btn {
    min-height: 44px;
    font-size: 0.875rem;
  }
}
</style>
