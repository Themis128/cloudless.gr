<template>
  <v-card class="contact-method-card" elevation="4">
    <v-card-text class="pa-6">
      <div class="text-center mb-4">
        <v-icon 
          :color="color" 
          size="48" 
          class="mb-3"
        >
          {{ icon }}
        </v-icon>
        <h3 class="text-h6 font-weight-bold mb-2">
          {{ title }}
        </h3>
        <p class="text-body-2 text-medium-emphasis">
          {{ description }}
        </p>
      </div>
      
      <v-divider class="my-4" />
      
      <div class="contact-info">
        <div 
          v-for="(info, index) in contactInfo" 
          :key="index"
          class="contact-item mb-2"
        >
          <div class="contact-label">{{ info.label }}:</div>
          <div class="contact-value">
            <a 
              v-if="info.link" 
              :href="info.link" 
              class="contact-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ info.value }}
            </a>
            <span v-else>{{ info.value }}</span>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface ContactInfo {
  label: string
  value: string
  link?: string
}

interface Props {
  icon: string
  title: string
  description: string
  color: string
  contactInfo: ContactInfo[]
}

defineProps<Props>()
</script>

<style scoped>
.contact-method-card {
  height: 100%;
  transition: all 0.3s ease-in-out;
}

.contact-method-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.contact-info {
  text-align: left;
}

.contact-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.contact-label {
  font-weight: 500;
  color: var(--v-theme-on-surface);
  font-size: 0.875rem;
  min-width: 80px;
}

.contact-value {
  flex: 1;
  text-align: right;
  font-size: 0.875rem;
  color: var(--v-theme-on-surface-variant);
}

.contact-link {
  color: var(--v-theme-primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.contact-link:hover {
  color: var(--v-theme-primary-darken-1);
  text-decoration: underline;
}
</style> 