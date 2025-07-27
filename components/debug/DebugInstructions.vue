<template>
  <v-card class="mb-6">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-information" class="mr-2" color="info" />
      How to Use This Debug Tool
      <v-spacer />
      <v-btn
        icon="mdi-chevron-up"
        variant="text"
        size="small"
        @click="expanded = !expanded"
      />
    </v-card-title>

    <v-expand-transition>
      <div v-show="expanded">
        <v-card-text>
          <div class="debug-instructions">
            <!-- Purpose Section -->
            <div class="instruction-section mb-4">
              <h4 class="text-h6 mb-2">
                <v-icon icon="mdi-target" size="20" class="mr-1" />
                Purpose
              </h4>
              <p class="text-body-2">
                {{ purpose }}
              </p>
            </div>

            <!-- Prerequisites Section -->
            <div
              v-if="prerequisites && prerequisites.length > 0"
              class="instruction-section mb-4"
            >
              <h4 class="text-h6 mb-2">
                <v-icon icon="mdi-check-circle" size="20" class="mr-1" />
                Prerequisites
              </h4>
              <ul class="text-body-2">
                <li v-for="(prereq, index) in prerequisites" :key="index">
                  {{ prereq }}
                </li>
              </ul>
            </div>

            <!-- Steps Section -->
            <div class="instruction-section mb-4">
              <h4 class="text-h6 mb-2">
                <v-icon icon="mdi-playlist-edit" size="20" class="mr-1" />
                How to Use
              </h4>
              <ol class="text-body-2">
                <li v-for="(step, index) in steps" :key="index" class="mb-2">
                  {{ step }}
                </li>
              </ol>
            </div>

            <!-- Tips Section -->
            <div
              v-if="tips && tips.length > 0"
              class="instruction-section mb-4"
            >
              <h4 class="text-h6 mb-2">
                <v-icon icon="mdi-lightbulb" size="20" class="mr-1" />
                Tips & Best Practices
              </h4>
              <ul class="text-body-2">
                <li v-for="(tip, index) in tips" :key="index">
                  {{ tip }}
                </li>
              </ul>
            </div>

            <!-- Troubleshooting Section -->
            <div
              v-if="troubleshooting && troubleshooting.length > 0"
              class="instruction-section"
            >
              <h4 class="text-h6 mb-2">
                <v-icon icon="mdi-wrench" size="20" class="mr-1" />
                Troubleshooting
              </h4>
              <div
                v-for="(issue, index) in troubleshooting"
                :key="index"
                class="mb-3"
              >
                <strong class="text-body-2">{{ issue.problem }}</strong>
                <p class="text-body-2 mt-1">{{ issue.solution }}</p>
              </div>
            </div>

            <!-- Related Tools -->
            <div
              v-if="relatedTools && relatedTools.length > 0"
              class="instruction-section mt-4"
            >
              <h4 class="text-h6 mb-2">
                <v-icon icon="mdi-tools" size="20" class="mr-1" />
                Related Debug Tools
              </h4>
              <div class="d-flex flex-wrap">
                <v-chip
                  v-for="tool in relatedTools"
                  :key="tool.name"
                  :color="tool.color"
                  variant="outlined"
                  size="small"
                  class="mr-2 mb-2"
                  :to="tool.path"
                >
                  <v-icon :icon="tool.icon" size="16" class="mr-1" />
                  {{ tool.name }}
                </v-chip>
              </div>
            </div>
          </div>
        </v-card-text>
      </div>
    </v-expand-transition>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface TroubleshootingItem {
  problem: string
  solution: string
}

interface RelatedTool {
  name: string
  path: string
  icon: string
  color: string
}

interface Props {
  purpose: string
  prerequisites?: string[]
  steps: string[]
  tips?: string[]
  troubleshooting?: TroubleshootingItem[]
  relatedTools?: RelatedTool[]
}

defineProps<Props>()

const expanded = ref(true)
</script>

<style scoped>
.debug-instructions {
  max-width: 100%;
}

.instruction-section {
  border-left: 3px solid #e0e0e0;
  padding-left: 16px;
}

.instruction-section h4 {
  color: #1976d2;
  font-weight: 600;
}

.instruction-section ul,
.instruction-section ol {
  margin-left: 16px;
}

.instruction-section li {
  margin-bottom: 4px;
}
</style>
