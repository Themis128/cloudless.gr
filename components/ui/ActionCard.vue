<template>
  <CardLayout :title="title" :loading="loading">
    <template #content>
      <div class="quick-actions-header">
        <div class="quick-actions-title">
          <p class="text-body-2 text-medium-emphasis">
            {{ subtitle }}
          </p>
        </div>
      </div>
      
      <div class="quick-actions-buttons">
        <slot name="actions">
          <!-- Dynamic actions from store -->
          <template v-if="actions && actions.length > 0">
            <v-btn
              v-for="action in actions"
              :key="action.id"
              class="action-btn"
              :color="action.color"
              :variant="action.variant"
              :size="action.size"
              :to="action.to"
              :href="action.href"
              :disabled="action.disabled"
              @click="handleActionClick(action)"
            >
              <v-icon start>{{ action.icon }}</v-icon>
              {{ action.label }}
            </v-btn>
          </template>
        </slot>
      </div>
    </template>
  </CardLayout>
</template>

<script setup lang="ts">
import type { ActionButton } from '~/stores/dashboardStore'
import CardLayout from './CardLayout.vue'

interface Props {
  title: string
  subtitle: string
  loading?: boolean
  actions?: ActionButton[]
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  actions: () => []
})

const handleActionClick = (action: ActionButton) => {
  if (action.onClick) {
    action.onClick()
  }
}
</script>

<style scoped>
.quick-actions-header {
  margin-bottom: 1rem;
}

.quick-actions-title {
  margin-bottom: 0.5rem;
}

.quick-actions-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.action-btn {
  flex: 1;
  min-width: 120px;
  border-radius: 8px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0.025em;
}

/* Responsive design */
@media (max-width: 768px) {
  .quick-actions-buttons {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style> 