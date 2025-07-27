<template>
  <v-card
    class="value-card"
    hover
    :elevation="4"
    @click="$emit('click')"
    role="button"
    tabindex="0"
    @keydown.enter="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <v-card-text class="pa-6">
      <div class="text-center">
        <div class="value-icon mb-4">
          <v-icon
            :icon="value.icon"
            size="48"
            :color="value.color"
            aria-hidden="true"
          />
        </div>

        <h3 class="text-h6 font-weight-bold mb-3">
          {{ value.title }}
        </h3>

        <p class="text-body-2 text-medium-emphasis">
          {{ value.description }}
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Value {
  id: string
  title: string
  description: string
  icon: string
  color: string
}

interface Props {
  value: Value
}

interface Emits {
  (e: 'click'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.value-card {
  height: 100%;
  cursor: pointer;
  transition: all 0.3s ease-in-out;
  border-radius: 16px;
}

.value-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15);
}

.value-card:focus-visible {
  outline: 2px solid var(--v-theme-primary);
  outline-offset: 2px;
}

.value-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.1);
  margin: 0 auto;
  transition: all 0.3s ease;
}

.value-card:hover .value-icon {
  background: rgba(var(--v-theme-primary), 0.2);
  transform: scale(1.1);
}

/* Ensure consistent card heights */
.v-card-text {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
}

/* Icon animation on hover */
.v-icon {
  transition: transform 0.3s ease;
}

.value-card:hover .v-icon {
  transform: scale(1.1);
}
</style>
