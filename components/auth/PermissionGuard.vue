<template>
  <div v-if="hasPermission" class="permission-guard">
    <slot />
  </div>
  <div v-else-if="showFallback" class="permission-fallback">
    <slot name="fallback">
      <div class="fallback-content">
        <v-icon size="48" color="warning">mdi-shield-lock</v-icon>
        <h3>Access Denied</h3>
        <p>You don't have permission to view this content.</p>
        <v-btn
          color="primary"
          variant="outlined"
          @click="$router.push('/dashboard')"
        >
          Go to Dashboard
        </v-btn>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  resource: string
  action: string
  showFallback?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showFallback: true
})

// Auth store
const authStore = useAuthStore()

// Computed
const hasPermission = computed(() => {
  if (!authStore.isAuthenticated) return false
  
  // Admin has all permissions
  if (authStore.isAdmin) return true
  
  // Check specific permission
  return authStore.hasPermission(props.resource, props.action)
})
</script>

<style scoped>
.permission-guard {
  width: 100%;
}

.permission-fallback {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.fallback-content {
  text-align: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  max-width: 400px;
}

.fallback-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 1rem 0 0.5rem 0;
}

.fallback-content p {
  color: #64748b;
  margin: 0 0 1.5rem 0;
  font-size: 1rem;
}
</style> 