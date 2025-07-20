<template>
  <div class="gradient-card" :class="cardClass">
    <div class="gradient-border">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'success' | 'warning' | 'info'
  hover?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  hover: true
})

const cardClass = computed(() => ({
  [`variant-${props.variant}`]: true,
  'hover-effect': props.hover
}))
</script>

<style scoped>
.gradient-card {
  position: relative;
  border-radius: 0.5rem;
  overflow: hidden;
}

.gradient-border {
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border-radius: 0.5rem;
  position: relative;
  padding: 1rem;
  transition: all 0.3s ease;
}

.gradient-border::before {
  background-size: 400% auto;
  border-radius: 0.5rem;
  bottom: 0;
  content: "";
  left: 0;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.5;
  padding: 2px;
  position: absolute;
  right: 0;
  top: 0;
  transition: background-position 0.3s ease-in-out, opacity 0.2s ease-in-out;
  width: 100%;
}

/* Light mode */
@media (prefers-color-scheme: light) {
  .gradient-border {
    background-color: hsla(0, 0%, 100%, 0.3);
  }
  
  .gradient-border::before {
    background: linear-gradient(90deg, #e2e2e2, #e2e2e2 25%, #00dc82 50%, #36e4da 75%, #0047e1);
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .gradient-border {
    background-color: hsla(0, 0%, 8%, 0.3);
  }
  
  .gradient-border::before {
    background: linear-gradient(90deg, #303030, #303030 25%, #00dc82 50%, #36e4da 75%, #0047e1);
  }
}

/* Variant colors */
.variant-primary .gradient-border::before {
  background: linear-gradient(90deg, #e2e2e2, #e2e2e2 25%, #00dc82 50%, #36e4da 75%, #0047e1);
}

.variant-success .gradient-border::before {
  background: linear-gradient(90deg, #e2e2e2, #e2e2e2 25%, #4caf50 50%, #8bc34a 75%, #cddc39);
}

.variant-warning .gradient-border::before {
  background: linear-gradient(90deg, #e2e2e2, #e2e2e2 25%, #ff9800 50%, #ffc107 75%, #ffeb3b);
}

.variant-info .gradient-border::before {
  background: linear-gradient(90deg, #e2e2e2, #e2e2e2 25%, #2196f3 50%, #03a9f4 75%, #00bcd4);
}

/* Hover effects */
.hover-effect:hover .gradient-border::before {
  background-position: -50% 0;
  opacity: 1;
}

.hover-effect:hover .gradient-border {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
</style> 