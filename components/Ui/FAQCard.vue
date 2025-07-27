<template>
  <v-card class="faq-card" elevation="2">
    <v-card-text class="pa-6">
      <div class="faq-header mb-3">
        <h4 class="text-h6 font-weight-bold mb-2">
          {{ faq.question }}
        </h4>
      </div>
      <div class="faq-content">
        <p class="text-body-2 text-medium-emphasis">
          {{ faq.answer }}
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface FAQ {
  id: number
  question: string
  answer: string
}

interface Props {
  faq: FAQ
}

defineProps<Props>()
</script>

<style scoped>
.faq-card {
  height: 100%;
  transition: all 0.3s ease-in-out;
}

.faq-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.faq-header {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  padding-bottom: 0.5rem;
}

.faq-content {
  line-height: 1.6;
}
</style> 