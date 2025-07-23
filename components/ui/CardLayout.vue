<template>
  <v-card 
    class="v-card v-theme--light v-card--density-default v-card--variant-elevated mb-4 bg-white consistent-card"
    :class="{ 'loading': loading }"
  >
    <!-- Loading State -->
    <div class="v-card__loader" v-if="loading">
      <v-progress-linear
        role="progressbar"
        aria-hidden="true"
        aria-valuemin="0"
        aria-valuemax="100"
        style="top: 0px; height: 0px; --v-progress-linear-height: 2px;"
      >
        <div class="v-progress-linear__background"></div>
        <div class="v-progress-linear__buffer" style="width: 0%;"></div>
        <div class="v-progress-linear__indeterminate">
          <div class="v-progress-linear__indeterminate long"></div>
          <div class="v-progress-linear__indeterminate short"></div>
        </div>
      </v-progress-linear>
    </div>
    
    <!-- Card Header -->
    <div class="v-card-title text-h6 card-header">
      <slot name="header">
        {{ title }}
      </slot>
    </div>
    
    <!-- Card Content -->
    <div class="v-card-text card-content">
      <slot name="content">
        <!-- Default content slot -->
      </slot>
    </div>
    
    <!-- Card Actions -->
    <div class="v-card-actions card-actions" v-if="$slots.actions">
      <slot name="actions" />
    </div>
    
    <!-- Card Underlay -->
    <span class="v-card__underlay"></span>
  </v-card>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  title: '',
  loading: false
})
</script>

<style scoped>
.consistent-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  border-radius: 12px;
  overflow: hidden;
}

.consistent-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.consistent-card.loading {
  opacity: 0.8;
}

.card-header {
  padding: 20px 24px 12px 24px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.87);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.card-content {
  padding: 16px 24px 20px 24px;
}

.card-actions {
  padding: 8px 24px 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

/* Consistent spacing for all card elements */
.v-card-title {
  font-size: 1.125rem;
  line-height: 1.4;
  margin-bottom: 0;
}

.v-card-text {
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .card-header,
  .card-content,
  .card-actions {
    padding-left: 16px;
    padding-right: 16px;
  }
  
  .v-card-title {
    font-size: 1rem;
  }
}

/* Dark theme support */
.v-theme--dark .consistent-card {
  background-color: #1e1e1e;
  color: rgba(255, 255, 255, 0.87);
}

.v-theme--dark .card-header {
  border-bottom-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.87);
}

.v-theme--dark .card-actions {
  border-top-color: rgba(255, 255, 255, 0.12);
}
</style> 