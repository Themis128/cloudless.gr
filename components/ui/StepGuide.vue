<template>
  <v-card class="step-guide mb-4" variant="outlined">
    <v-card-title class="d-flex align-center text-subtitle-1">
      <v-icon start color="primary" class="me-2">
        mdi-book-open-variant
      </v-icon>
      Step Guide & Template
    </v-card-title>
    
    <v-card-text>
      <!-- Guide Section -->
      <div v-if="guideContent" class="guide-section mb-4">
        <h4 class="text-subtitle-2 font-weight-bold mb-2">
          📖 Read the Guide
        </h4>
        <div class="guide-content" v-html="guideContent"></div>
      </div>

      <!-- Template Section -->
      <div v-if="templateInfo" class="template-section">
        <h4 class="text-subtitle-2 font-weight-bold mb-2">
          📋 Template Information
        </h4>
        <v-alert type="info" variant="tonal" class="mb-3">
          <strong>Template:</strong> {{ templateInfo.name }}
        </v-alert>
        <div class="template-details">
          <p class="text-body-2 mb-2">
            <strong>Description:</strong> {{ templateInfo.description }}
          </p>
          <div v-if="templateInfo.category" class="mb-2">
            <strong>Category:</strong> 
            <v-chip size="small" color="primary" variant="tonal" class="ms-1">
              {{ templateInfo.category }}
            </v-chip>
          </div>
          <div v-if="templateInfo.tags && templateInfo.tags.length" class="mb-2">
            <strong>Tags:</strong>
            <v-chip 
              v-for="tag in templateInfo.tags" 
              :key="tag"
              size="small" 
              color="secondary" 
              variant="tonal" 
              class="ms-1"
            >
              {{ tag }}
            </v-chip>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-4 d-flex gap-2">
        <v-btn 
          v-if="guideContent"
          color="primary" 
          variant="outlined" 
          size="small"
          @click="showFullGuide = !showFullGuide"
        >
          <v-icon start>mdi-book-open</v-icon>
          {{ showFullGuide ? 'Hide' : 'Show' }} Full Guide
        </v-btn>
        
        <v-btn 
          v-if="templateInfo"
          color="secondary" 
          variant="outlined" 
          size="small"
          @click="loadTemplate"
        >
          <v-icon start>mdi-content-copy</v-icon>
          Load Template
        </v-btn>
      </div>

      <!-- Full Guide Dialog -->
      <v-dialog v-model="showFullGuide" max-width="800">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            Complete Guide
            <v-btn icon="mdi-close" variant="text" @click="showFullGuide = false" />
          </v-card-title>
          <v-card-text>
            <div v-html="fullGuideContent"></div>
          </v-card-text>
        </v-card>
      </v-dialog>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface TemplateInfo {
  name: string
  description: string
  category?: string
  tags?: string[]
  [key: string]: any
}

interface Props {
  guideContent?: string
  fullGuideContent?: string
  templateInfo?: TemplateInfo
  stepNumber?: number
  stepName?: string
}

const props = withDefaults(defineProps<Props>(), {
  stepNumber: 1,
  stepName: 'Step'
})

const emit = defineEmits<{
  'load-template': [template: TemplateInfo]
}>()

const showFullGuide = ref(false)

const loadTemplate = () => {
  if (props.templateInfo) {
    emit('load-template', props.templateInfo)
  }
}
</script>

<style scoped>
.step-guide {
  border-left: 4px solid var(--v-primary-base);
}

.guide-content {
  font-size: 0.875rem;
  line-height: 1.5;
}

.template-details {
  font-size: 0.875rem;
}

.guide-section, .template-section {
  padding: 12px;
  background-color: rgba(var(--v-theme-primary), 0.05);
  border-radius: 8px;
}
</style> 