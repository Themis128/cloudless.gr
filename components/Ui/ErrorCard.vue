<template>
  <v-card 
    class="error-card pa-6 text-center" 
    elevation="3" 
    :max-width="maxWidth"
    style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);"
  >
    <v-icon
      :icon="icon"
      :size="iconSize"
      :color="color"
      class="mb-4"
    />
    
    <h2 class="text-h5 mb-2" :class="`text-${color}`">
      {{ title }}
    </h2>
    
    <p class="text-body-1 text-medium-emphasis mb-4">
      {{ message }}
    </p>
    
    <div class="d-flex flex-column flex-sm-row gap-2 justify-center">
      <v-btn
        v-if="retryAction"
        :color="color"
        variant="elevated"
        @click="$emit('retry')"
        :loading="loading"
      >
        <v-icon start icon="mdi-refresh"></v-icon>
        {{ retryText }}
      </v-btn>
      
      <v-btn
        v-if="fallbackAction"
        color="secondary"
        variant="outlined"
        @click="$emit('fallback')"
      >
        {{ fallbackText }}
      </v-btn>
    </div>
    
    <!-- Additional Details (expandable) -->
    <v-expand-transition>
      <div v-if="showDetails && details">
        <v-divider class="my-4"></v-divider>
        <v-card variant="tonal" class="pa-3">
          <div class="text-caption text-left">
            <strong>Technical Details:</strong><br>
            {{ details }}
          </div>
        </v-card>
      </div>
    </v-expand-transition>
    
    <v-btn
      v-if="details"
      variant="text"
      size="small"
      class="mt-2"
      @click="showDetails = !showDetails"
    >
      {{ showDetails ? 'Hide' : 'Show' }} Details
      <v-icon :icon="showDetails ? 'mdi-chevron-up' : 'mdi-chevron-down'"></v-icon>
    </v-btn>
  </v-card>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  message?: string
  details?: string
  icon?: string
  color?: string
  iconSize?: string | number
  maxWidth?: string | number
  retryAction?: boolean
  retryText?: string
  fallbackAction?: boolean
  fallbackText?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Something went wrong',
  message: 'An unexpected error occurred. Please try again.',
  icon: 'mdi-alert-circle',
  color: 'error',
  iconSize: '64',
  maxWidth: 500,
  retryAction: true,
  retryText: 'Retry',
  fallbackAction: false,
  fallbackText: 'Go Back',
  loading: false
})

defineEmits<{
  retry: []
  fallback: []
}>()

const showDetails = ref(false)
</script>

<style scoped>
.error-card {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
